import {
  getApiRequestConnection,
  getApiRequestProfile,
  getHermesConfigRecord,
  type HermesConfigRecord,
  saveHermesConfig,
} from "@/hermes";
import type { I18nConfigClient } from "@/i18n/context";
import type { Locale } from "@/i18n/types";

export const VIETNAMESE_INITIAL_LOCALE: Locale = "vi";

export interface RawConfigClient {
  getRawConfig: () => Promise<{ yaml: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Apply the Vietnamese edition's first-run policy without changing the
 * upstream English fallback or overriding a language the user already chose. */
export function withVietnameseLocaleDefault(
  config: HermesConfigRecord,
  hasExplicitLanguage = true,
): HermesConfigRecord {
  const display = isRecord(config.display) ? config.display : {};
  const configuredLanguage = display.language;

  if (
    hasExplicitLanguage &&
    typeof configuredLanguage === "string" &&
    configuredLanguage.trim().length > 0
  ) {
    return config;
  }

  return {
    ...config,
    display: {
      ...display,
      language: VIETNAMESE_INITIAL_LOCALE,
    },
  };
}

function yamlLineWithoutComment(line: string): string {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote) {
      if (char === quote && (quote === "'" || line[index - 1] !== "\\")) {
        quote = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

const YAML_DISPLAY_KEY = /^(?:display|'display'|"display")\s*:\s*(.*)$/;
const YAML_LANGUAGE_KEY = /^(?:language|'language'|"language")\s*:/;
const YAML_FLOW_LANGUAGE_KEY =
  /(?:^|[{,]\s*)(?:language|'language'|"language")\s*:/;

/** Detect the persisted user choice in the raw public config response. The
 * upstream writer serializes this mapping in block YAML; JSON/flow mappings
 * are accepted as well so hand-edited valid configs do not lose their choice. */
export function rawConfigHasExplicitDisplayLanguage(rawYaml: string): boolean {
  const trimmed = rawYaml.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);

      return (
        isRecord(parsed) &&
        isRecord(parsed.display) &&
        Object.hasOwn(parsed.display, "language")
      );
    } catch {
      // Continue with the YAML scanner for a valid flow-style YAML document.
    }
  }

  let displayIndent: number | null = null;

  for (const rawLine of rawYaml.split(/\r?\n/)) {
    const line = yamlLineWithoutComment(rawLine);

    if (!line.trim()) {
      continue;
    }

    const indent = line.length - line.trimStart().length;
    const value = line.trim();

    if (displayIndent !== null && indent > displayIndent) {
      if (YAML_LANGUAGE_KEY.test(value)) {
        return true;
      }

      continue;
    }

    displayIndent = null;

    if (indent !== 0) {
      continue;
    }

    const display = value.match(YAML_DISPLAY_KEY);

    if (!display) {
      continue;
    }

    if (YAML_FLOW_LANGUAGE_KEY.test(display[1] ?? "")) {
      return true;
    }

    displayIndent = indent;
  }

  return false;
}

export function withVietnameseLocalePolicy(
  client: I18nConfigClient,
  rawClient: RawConfigClient,
): I18nConfigClient {
  return {
    getConfig: async () => {
      const [config, raw] = await Promise.all([
        client.getConfig(),
        rawClient.getRawConfig(),
      ]);

      return withVietnameseLocaleDefault(
        config,
        rawConfigHasExplicitDisplayLanguage(raw.yaml),
      );
    },
    saveConfig: (config) => client.saveConfig(config),
  };
}

const desktopConfigClient: I18nConfigClient = {
  getConfig: () => {
    if (typeof window === "undefined" || !window.hermesDesktop?.api) {
      return Promise.resolve({});
    }

    return getHermesConfigRecord();
  },
  saveConfig: (config) => {
    if (typeof window === "undefined" || !window.hermesDesktop?.api) {
      return Promise.resolve({ ok: true });
    }

    return saveHermesConfig(config);
  },
};

const desktopRawConfigClient: RawConfigClient = {
  getRawConfig: () => {
    if (typeof window === "undefined" || !window.hermesDesktop?.api) {
      return Promise.resolve({ yaml: "" });
    }

    const connectionId = getApiRequestConnection();
    const profile = getApiRequestProfile();

    return window.hermesDesktop.api<{ yaml: string }>({
      ...(connectionId ? { connectionId } : {}),
      ...(profile ? { profile } : {}),
      path: "/api/config/raw",
    });
  },
};

export const vietnameseI18nConfigClient = withVietnameseLocalePolicy(
  desktopConfigClient,
  desktopRawConfigClient,
);
