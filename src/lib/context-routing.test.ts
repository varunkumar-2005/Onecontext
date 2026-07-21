import test from "node:test";
import assert from "node:assert/strict";
import { routeProjectContext } from "./context-routing";

test("smart routing skips casual prompts", () => { assert.equal(routeProjectContext("h", "atlas architecture postgres").shouldInject, false); assert.equal(routeProjectContext("hello", "atlas architecture postgres").reason, "casual_prompt"); });
test("smart routing skips conversational greetings", () => { assert.equal(routeProjectContext("hi how are you", "atlas architecture postgres").reason, "casual_prompt"); });
test("smart routing recognizes project terms and intent", () => { assert.equal(routeProjectContext("How is the Postgres architecture set up?", "atlas architecture postgres").shouldInject, true); assert.equal(routeProjectContext("What is the team working on?", "atlas architecture postgres").shouldInject, true); });
test("smart routing recognizes an explicit conversation handoff", () => { assert.equal(routeProjectContext("Continue from the saved handoff", "atlas architecture postgres").shouldInject, true); });
