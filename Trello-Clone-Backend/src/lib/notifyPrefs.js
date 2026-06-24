// Email notifications are opt-in via Settings -> Notifications -> Email
// (stored as User.settings.notifications.email === true).
// Password-reset emails bypass this (they call enqueueEmail directly).
// The `type` param is accepted for future per-type granularity.
export function emailEnabled(settings, _type) {
  return settings?.notifications?.email === true;
}
