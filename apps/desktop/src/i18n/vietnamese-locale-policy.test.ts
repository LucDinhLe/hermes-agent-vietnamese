import { describe, expect, it, vi } from "vitest";

import {
  rawConfigHasExplicitDisplayLanguage,
  VIETNAMESE_INITIAL_LOCALE,
  withVietnameseLocaleDefault,
  withVietnameseLocalePolicy,
} from "./vietnamese-locale-policy";

describe("Hermes Vietnamese locale policy", () => {
  it("adds Vietnamese only when a profile has no configured display language", () => {
    expect(withVietnameseLocaleDefault({ model: { default: "demo" } })).toEqual(
      {
        model: { default: "demo" },
        display: { language: "vi" },
      },
    );
    expect(
      withVietnameseLocaleDefault({ display: { density: "compact" } }),
    ).toEqual({
      display: { density: "compact", language: "vi" },
    });
    expect(VIETNAMESE_INITIAL_LOCALE).toBe("vi");
  });

  it.each(["en", "ja", "unsupported-explicit-value"])(
    "preserves an explicit %s choice",
    (language) => {
      const config = { display: { language }, untouched: true };

      expect(withVietnameseLocaleDefault(config)).toBe(config);
    },
  );

  it("overrides the effective upstream English default when raw config has no language choice", () => {
    expect(
      withVietnameseLocaleDefault(
        { display: { language: "en", skin: "mono" } },
        false,
      ),
    ).toEqual({
      display: { language: "vi", skin: "mono" },
    });
  });

  it.each([
    ["block YAML", "display:\n  language: en\n"],
    ["quoted keys", '"display":\n  "language": ja\n'],
    ["flow YAML", "display: { skin: mono, language: en }\n"],
    ["JSON", '{"display":{"language":"en"}}'],
  ])("detects an explicit display language in %s", (_label, yaml) => {
    expect(rawConfigHasExplicitDisplayLanguage(yaml)).toBe(true);
  });

  it.each([
    ["empty config", ""],
    ["commented language", "display:\n  # language: en\n  skin: mono\n"],
    [
      "language in another section",
      "agent:\n  language: en\ndisplay:\n  skin: mono\n",
    ],
    ["language text inside a string", 'display:\n  skin: "language: en"\n'],
  ])("does not invent a language choice for %s", (_label, yaml) => {
    expect(rawConfigHasExplicitDisplayLanguage(yaml)).toBe(false);
  });

  it("adapts reads through the public config contract and passes saves through unchanged", async () => {
    const saveConfig = vi.fn(async () => ({ ok: true }));

    const client = withVietnameseLocalePolicy(
      {
        getConfig: vi.fn(async () => ({
          display: { language: "en" },
          untouched: true,
        })),
        saveConfig,
      },
      {
        getRawConfig: vi.fn(async () => ({
          yaml: "model:\n  default: demo\n",
        })),
      },
    );

    await expect(client.getConfig()).resolves.toEqual({
      untouched: true,
      display: { language: "vi" },
    });

    const selected = { display: { language: "en" } };

    await expect(client.saveConfig(selected)).resolves.toEqual({ ok: true });
    expect(saveConfig).toHaveBeenCalledWith(selected);
  });

  it.each(["en", "ja"])(
    "preserves a raw explicit %s choice from the effective config",
    async (language) => {
      const config = { display: { language }, untouched: true };
      const client = withVietnameseLocalePolicy(
        { getConfig: vi.fn(async () => config), saveConfig: vi.fn() },
        {
          getRawConfig: vi.fn(async () => ({
            yaml: `display:\n  language: ${language}\n`,
          })),
        },
      );

      await expect(client.getConfig()).resolves.toBe(config);
    },
  );
});
