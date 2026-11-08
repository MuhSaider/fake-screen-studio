# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | :white_check_mark: |

Pre-1.0 releases are supported on the latest minor line only.

## Reporting a vulnerability

Please **do not** open a public issue. Report privately through
[GitHub Security Advisories](https://github.com/MuhSaider/fake-screen-studio/security/advisories/new)
or email **sderiyanto@gmail.com** with:

- affected version and platform,
- a minimal reproduction (scenario file and command),
- the impact you believe it has.

You can expect an acknowledgement within a few days. Once a fix is ready, we will publish
a patched release and credit you in the advisory unless you prefer to stay anonymous.

## Scope notes

Fake Screen Studio runs entirely on your machine:

- `npm run render` launches a local Vite server on `localhost` and a locally installed
  browser through `puppeteer-core`; no page content is fetched from the network.
- Scenarios are JSON data. They are validated against the registry before rendering, but
  they are not a security boundary — treat scenarios from untrusted sources like any other
  code you run locally.
- The scaffolder writes files only inside the target directory and refuses to merge into a
  non-empty directory.

Reports about the underlying browser, `puppeteer-core`, `vite`, or `ffmpeg-static` should
go to their respective projects; we will still bump dependencies when a fix is available.
