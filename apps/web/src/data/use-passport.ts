import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import { loadFixtureState, scenarioFromSearch } from "./fixture-source";
import { getLaunchToken } from "./launch-token";
import type { LoadState } from "./snapshot";

/*
 * The one seam between screens and data. Today it resolves fixtures; the `/api` client replaces
 * `loadFixtureState` here and nowhere else. Requests will carry the launch token in
 * `X-Agent-Passport-Local-Token`; a 401 maps to `unauthorized`, no published Passport to `empty`.
 */
export type PassportQuery = {
  readonly state: LoadState;
  readonly reload: () => void;
};

export function usePassport(): PassportQuery {
  const location = useLocation();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    // In development the scenario comes from `?scenario=`; a build only ever shows live state.
    const scenario = import.meta.env.DEV ? scenarioFromSearch(location.search) : "ready";
    const authorized = import.meta.env.DEV || getLaunchToken() !== undefined;

    const pending = authorized
      ? loadFixtureState(scenario)
      : Promise.resolve<LoadState>({ status: "unauthorized" });

    void pending.then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [location.search, attempt]);

  return { state, reload: () => setAttempt((count) => count + 1) };
}
