import { Router } from "itty-router"
import { ShareUser, type EventIncidents as EventIncidentsData, Incident } from "../types/EventIncidents"
import { response } from "./utils"
import { WebSocketMessage, WebSocketPayload, WebSocketPeerMessage, WebSocketSender, WebSocketServerMessage } from "../types/api";

export type SessionClient = {
    user: ShareUser;
    socket: WebSocket
    ip: string
    active: boolean
}

export interface Env {
    SHARES: KVNamespace;
};

export class EventIncidents implements DurableObject {
    router = Router()
    clients: SessionClient[] = []
    state: DurableObjectState
    env: Env

    constructor(state: DurableObjectState, env: Env) {
        this.state = state
        this.env = env
        this.router
            .get("/join", this.handleWebsocket.bind(this))
            .post("/init", this.handleInit.bind(this))
            .all("*", () => response({ success: false, reason: "bad_request", details: "unknown action" }))
    }

    // Storage
    async getOwner() {
        return this.state.storage.get<ShareUser>("owner");
    };

    async setOwner(owner: ShareUser) {
        return this.state.storage.put<ShareUser>("owner", owner);
    };

    async getSKU() {
        return this.state.storage.get<string>("sku");
    };

    async setSKU(sku: string) {
        return this.state.storage.put<string>("sku", sku);
    };

    async addIncident(incident: Incident) {
        await this.state.blockConcurrencyWhile(async () => {
            await this.state.storage.put(incident.id, incident);
            const list = await this.state.storage.get<string[]>("incidents") ?? [];
            list.push(incident.id);
            await this.state.storage.put("incidents", list);
        });
    };

    async editIncident(incident: Incident) {
        this.state.blockConcurrencyWhile(async () => {
            await this.state.storage.put(incident.id, incident);
        })
    };

    async deleteIncident(id: string) {
        this.state.blockConcurrencyWhile(async () => {
            const list = await this.state.storage.get<string[]>("incidents") ?? [];
            await this.state.storage.put("incidents", list.filter(value => value !== id));
        })
    }

    async getIncident(id: string) {
        return this.state.storage.get<Incident>(id);
    };

    async getIncidentList() {
        return await this.state.storage.get<string[]>("incidents") ?? [];
    };

    async getAllIncidents(): Promise<Incident[]> {
        const ids = await this.getIncidentList();
        const incidents = await Promise.all(ids.map(id => this.getIncident(id)));
        return incidents.filter(i => !!i) as Incident[]
    };

    async getData(): Promise<EventIncidentsData> {
        const sku = await this.getSKU();
        const owner = await this.getOwner();
        const incidents = await this.getAllIncidents();

        return { sku: sku ?? "", owner, incidents };
    };

    async createServerShareMessage(): Promise<WebSocketServerMessage> {
        const data = await this.getData();
        return {
            type: "server_share_info",
            users: this.clients.map(client => client.user.name),
            data: { ...data, owner: data.owner?.name ?? "" },
        }
    };

    createPayload<T extends WebSocketMessage = WebSocketMessage>(message: T, sender: WebSocketSender): WebSocketPayload<T> {
        return { ...message, sender, date: new Date().toISOString() }
    };

    async fetch(request: Request) {
        return this.router.handle(request)
    }

    async handleInit(request: Request) {
        const data = await request.json<EventIncidentsData>();

        await this.setOwner(data.owner!);
        await this.setSKU(data.sku);

        for (const incident of data.incidents) {
            await this.addIncident(incident);
        };
    };

    async handleWebsocket(request: Request) {
        const ip = request.headers.get("CF-Connecting-IP") ?? "0.0.0.0"

        if (request.headers.get("Upgrade") === "websocket") {
            const pair = new WebSocketPair()

            const search = new URL(request.url).searchParams;

            const name = search.get("name");
            const id = search.get("id");

            if (!name || !id) {
                return response({ success: false, reason: "bad_request", details: "Must specify a user name and user id" });
            }

            this.handleSession(pair[1], ip, { name, id })
            await this.updateExpiration()

            return new Response(null, { status: 101, webSocket: pair[0] })
        }
    };

    async handleSession(socket: WebSocket, ip: string, user: ShareUser) {
        socket.accept()

        const client: SessionClient = { socket, ip, active: true, user }
        this.clients.push(client)

        if (this.clients.length === 1) {
            this.setOwner(user);
        }

        // Set event handlers to receive messages.
        socket.addEventListener("message", async (event: MessageEvent) => {
            try {
                if (!client.active) {
                    socket.close(1011, "WebSocket broken.");
                    return
                }

                const data = JSON.parse(event.data as string) as WebSocketPayload<WebSocketPeerMessage>;

                switch (data.type) {

                    case "add_incident": {
                        const incident = data.incident;
                        await this.addIncident(incident);
                        this.broadcast({ type: "add_incident", incident }, { type: "client", name: client.user.name });
                        break;
                    }
                    case "update_incident": {
                        const incident = data.incident;
                        await this.editIncident(incident);
                        this.broadcast({ type: "update_incident", incident }, { type: "client", name: client.user.name });
                        break;
                    }
                    case "remove_incident": {
                        await this.deleteIncident(data.id);
                        this.broadcast({ type: "remove_incident", id: data.id }, { type: "client", name: client.user.name });
                        break;
                    }
                    case "message": {
                        this.broadcast({ type: "message", message: data.message }, { type: "client", name: client.user.name })
                        break;
                    }

                };

            } catch (err) {
                socket.send(JSON.stringify({ error: err }))
            }
        });

        const state = await this.createServerShareMessage();
        const payload = this.createPayload(state, { type: "server" });

        await socket.send(JSON.stringify(payload));
        await this.broadcast({ type: "server_user_add", user: user.name }, { type: "server" })

        const quitHandler = async () => {
            client.active = false
            this.clients = this.clients.filter((member) => member !== client)

            if (client.user) {
                await this.broadcast({ type: "server_user_remove", user: client.user.name }, { type: "server" })
            }
        }

        socket.addEventListener("close", quitHandler)
        socket.addEventListener("error", quitHandler)
    }

    async broadcast<T extends WebSocketMessage>(message: T, sender: WebSocketSender) {
        const payload: WebSocketPayload<T> = this.createPayload(message, sender);

        const clientLefts: SessionClient[] = [];

        this.clients = this.clients.filter((client) => {
            try {
                client.socket.send(JSON.stringify(payload))

                return true
            } catch (err) {
                client.active = false
                clientLefts.push(client)

                return false
            }
        })

        clientLefts.forEach((client) => {
            if (client.user) {
                this.broadcast({ type: "server_user_remove", user: client.user.name }, { type: "server" });
            }
        });

        // Detect owner loss and reassign owner
        const owner = await this.getOwner();
        const ownerSession = this.clients.find(session => session.user.id === owner?.id);

        if (!ownerSession || !ownerSession.active) {
            const firstActive = this.clients.find(session => session.active);
            if (firstActive) {
                await this.setOwner(firstActive.user);
                const message = await this.createServerShareMessage();
                await this.broadcast(message, { type: "server" });
            }
        };
    };

    async updateExpiration() {
        await this.state.storage.setAlarm(Date.now() + 86400 * 1000)
    }

    async alarm() {
        await this.destroy()
    }

    async destroy() {
        await this.state.storage.deleteAll();
    }
}