import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type I18nConfigClient, I18nProvider, useI18n } from "./context";
import {
  VIETNAMESE_INITIAL_LOCALE,
  withVietnameseLocalePolicy,
} from "./vietnamese-locale-policy";

afterEach(cleanup);

function LocaleProbe() {
  const { locale } = useI18n();

  return <output aria-label="active-locale">{locale}</output>;
}

describe("fresh-profile locale boot", () => {
  it("keeps Vietnamese when effective config injects English but raw profile never chose a language", async () => {
    const upstreamConfigClient: I18nConfigClient = {
      getConfig: vi.fn(async () => ({
        display: { language: "en" },
        model: { default: "demo" },
      })),
      saveConfig: vi.fn(async () => ({ ok: true })),
    };

    const configClient = withVietnameseLocalePolicy(upstreamConfigClient, {
      getRawConfig: vi.fn(async () => ({ yaml: "model:\n  default: demo\n" })),
    });

    render(
      <I18nProvider
        configClient={configClient}
        initialLocale={VIETNAMESE_INITIAL_LOCALE}
      >
        <LocaleProbe />
      </I18nProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("active-locale").textContent).toBe("vi"),
    );
  });

  it("keeps Vietnamese when config loading fails during cold start", async () => {
    const configClient: I18nConfigClient = {
      getConfig: vi.fn(async () => {
        throw new Error("backend still starting");
      }),
      saveConfig: vi.fn(async () => ({ ok: true })),
    };

    render(
      <I18nProvider
        configClient={configClient}
        configLoadFallbackLocale={VIETNAMESE_INITIAL_LOCALE}
        initialLocale={VIETNAMESE_INITIAL_LOCALE}
      >
        <LocaleProbe />
      </I18nProvider>,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("active-locale").textContent).toBe("vi"),
    );
  });
});
