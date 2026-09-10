import { DEVICE_ROUTES, STREAM_ROUTES, type DeviceSecurityOverview, type PublicDevice } from "@movie-server/shared";
import { apiFetch } from "./api";

export const deviceApi = {
  overview: () => apiFetch<DeviceSecurityOverview>(DEVICE_ROUTES.List),
  rename: (id: string, name: string) =>
    apiFetch<{ device: PublicDevice }>(DEVICE_ROUTES.One.replace(":id", id), {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  revoke: (id: string) =>
    apiFetch<{ message: string; current: boolean }>(DEVICE_ROUTES.One.replace(":id", id), {
      method: "DELETE",
    }),
  activeStreams: () => apiFetch<{ streams: DeviceSecurityOverview["streams"] }>(STREAM_ROUTES.Active),
};
