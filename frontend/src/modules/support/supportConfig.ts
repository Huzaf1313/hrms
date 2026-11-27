export interface SupportContactConfig {
  email: string;
  phone: string;
  workingHours: string;
}

const DEFAULT_SUPPORT_CONTACT: SupportContactConfig = {
  email:
    (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() ||
    "support@peoplesync.io",
  phone:
    (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim() ||
    "+91 80 4123 4500",
  workingHours:
    (import.meta.env.VITE_SUPPORT_HOURS as string | undefined)?.trim() ||
    "Mon - Fri, 9:30 AM - 6:30 PM",
};

interface StoredSettingsShape {
  organization?: {
    contactEmail?: string;
    phoneNumber?: string;
  };
  workingDays?: string[];
}

export function getSupportContactConfig(
  overrides?: Partial<SupportContactConfig>,
): SupportContactConfig {
  let storedOrg: StoredSettingsShape["organization"] | undefined;
  let storedDays: string[] | undefined;

  try {
    const raw = localStorage.getItem("hrms_settings");
    if (raw) {
      const parsed = JSON.parse(raw) as StoredSettingsShape;
      storedOrg = parsed.organization;
      storedDays = parsed.workingDays;
    }
  } catch {
    // Ignore storage read failures and fall back to env/default config
  }

  const workingHoursFromDays =
    Array.isArray(storedDays) && storedDays.length > 0
      ? `${storedDays[0]} - ${storedDays[storedDays.length - 1]}, 9:30 AM - 6:30 PM`
      : undefined;

  return {
    email:
      overrides?.email?.trim() ||
      storedOrg?.contactEmail?.trim() ||
      DEFAULT_SUPPORT_CONTACT.email,
    phone:
      overrides?.phone?.trim() ||
      storedOrg?.phoneNumber?.trim() ||
      DEFAULT_SUPPORT_CONTACT.phone,
    workingHours:
      overrides?.workingHours?.trim() ||
      workingHoursFromDays ||
      DEFAULT_SUPPORT_CONTACT.workingHours,
  };
}
