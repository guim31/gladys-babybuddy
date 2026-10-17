// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+). The child is
// a device of the integration (`source: "devices"`).
//
// `log_diaper`: note a wet, dirty or wet and dirty diaper, now.
// `track_activity`: start, stop or toggle the sleep or feeding timer of a
// child — "toggle" suits a single Zigbee button by the cot at night.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  async log_diaper(hub, { fields = {} }) {
    const { child, kind } = await hub.logDiaper(fields.child, fields.kind);
    return { child_name: child.firstName, kind };
  },

  async track_activity(hub, { fields = {} }) {
    const { child, running, minutes } = await hub.activity(
      fields.child,
      fields.activity,
      fields.command,
    );
    return { child_name: child.firstName, running, duration_minutes: minutes };
  },
};
