import { AutoRouter, IRequest, withParams } from "itty-router";
import { corsify, preflight } from "./utils/request";
import { Env } from "./types";

import { integrationRouter } from "./routers/integration";
import { registrationRouter } from "./routers/registration";
import { keyExchangeRouter } from "./routers/keyexchange";
import { invitationRouter } from "./routers/invitation";
import { instanceRouter } from "./routers/instance";

const router = AutoRouter<IRequest, [Env]>({
  before: [preflight, withParams],
  finally: [corsify],
});

router

  // External Integration API (just requires bearer token)
  .all("/api/integration/v1/:sku/*", integrationRouter.fetch)

  // User Registration
  .post("/api/user", registrationRouter.fetch)

  // Key Exchange
  .put("/api/:sku/request", keyExchangeRouter.fetch)
  .get("/api/:sku/request", keyExchangeRouter.fetch)

  // Manage Invitations
  .post("/api/:sku/create", invitationRouter.fetch)
  .get("/api/:sku/invitation", invitationRouter.fetch)
  .put("/api/:sku/accept", invitationRouter.fetch)

  // Instance Actions
  .put("/api/:sku/invite", instanceRouter.fetch)
  .delete("/api/:sku/invite", instanceRouter.fetch)
  .all("/api/:sku/:path+", instanceRouter.fetch);

export default { ...router };

export { ShareInstance } from "./objects/instance";
