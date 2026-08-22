import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "../src/routeTree.gen";

describe("router navigation", () => {
  it("resolves the core app routes and stock detail route", () => {
    const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });

    const routes = ["/", "/scanner", "/watchlist", "/portfolio", "/alerts", "/settings"] as const;

    for (const route of routes) {
      expect(router.buildLocation({ to: route as never })).toMatchObject({ pathname: route });
    }

    expect(router.buildLocation({ to: "/stock/$symbol", params: { symbol: "DEVHAL" } })).toMatchObject({
      pathname: "/stock/DEVHAL",
    });
  });
});
