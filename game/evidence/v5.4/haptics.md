# Actual-flow button haptics

One arbiter follows actual positive jet pressure/volumeRate, not held duration or residual circulation. Requested pulse duration/interval:12/160ms,22/120ms,36/90ms. The API cannot set physical amplitude. Release/depletion/pause/blur/hidden/pagehide/reset/win/dispose cancel; two buttons share one timer. Missing/false/throw gracefully disable output.

11 focused deterministic tests cover real WaterWorld and unchanged bindControls, finite pump discharge/refill, dual input, no request spam, all stop lifecycles and unsupported output. API spies verify requests only; no physical phone vibration measurement. Main integration is inspected separately; final combined validation and public-release hashes are recorded by root.
