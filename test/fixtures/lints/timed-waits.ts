// A test that waits a time where it should wait for a condition: the timed-waits lint finds the first four, and none
// of the rest, which wait a turn of the event loop at most, set a limit, or wait for a condition.
const tick = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));
const until = async (test: () => boolean) => void test();
const page = { waitForTimeout: async (ms: number) => void ms };
const test = { setTimeout: (ms: number) => void ms };
const done = () => undefined;

export async function bad() {
  await tick(300);
  await new Promise((r) => setTimeout(r, 1_000));
  await page.waitForTimeout(400);
  setTimeout(() => {
    done();
  }, 200);
}

export async function fine() {
  await tick();
  await tick(20);
  await new Promise((r) => setTimeout(r, 50));
  test.setTimeout(300_000);
  await until(() => true);
  // await tick(500) in a comment is not a wait.
}
