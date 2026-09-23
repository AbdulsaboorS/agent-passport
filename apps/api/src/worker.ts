import { createPassportApp } from "./app.js";
import { D1PassportStore } from "./d1-store.js";
import { PassportService } from "./service.js";

type Environment = {
  DB: D1Database;
};

export default {
  async fetch(request, environment) {
    const store = new D1PassportStore(environment.DB);
    const service = new PassportService({ store });
    const app = createPassportApp({ service, store });

    return await app.fetch(request);
  },
} satisfies ExportedHandler<Environment>;
