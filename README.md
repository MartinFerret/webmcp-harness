# webmcp-harness

A tiny agent harness: from a browser agent that lies about success to an
Angular app exposing WebMCP tools. Measured.

## The idea

A browser agent must book "Tuesday 14:00 for Alice" in a small Angular app.
The first version (v0) clicks around and claims success when it failed. We
then add a few harness layers, and finally let the app expose a WebMCP tool.

Same prompt, same model, same task every time: only the harness changes.

The whole harness is meant to stay small and readable: a few hundred lines.

Inspired by Tejas Kumar's talk on agent harnesses.

Work in progress. Results, traces and how to run it will land here.
