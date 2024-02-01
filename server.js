const ipc = require("node-ipc").default;

ipc.config.id = "world";
ipc.config.retry = 1500;
ipc.config.rawBuffer = true;
ipc.config.encoding = "ascii";
ipc.config.silent = true;
ipc.config.logDepth = 0; //default
ipc.config.logger = () => {};

ipc.serve(function () {
  ipc.server.on("connect", function (socket) {
    ipc.server.emit(
      socket,
      JSON.stringify({
        method: "status",
        message: "connected",
      })
    );
  });

  ipc.server.on("data", function (data, socket) {
    const { spawn } = require("node:child_process", [], { shell: true });
    let child;
    let text;
    let inputDone = false;
    try {
      const args = JSON.parse(data.toString());
      text = args[0];
      child = spawn(`interpreter`, [
        "-ci",
        "Default to using Google Chrome",
        "--os",
        "--api_key",
        args[1],
      ]);
    } catch (e) {
      console.log("caught", e);
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: e.toString(),
        })
      );
    }

    child.on("error", function (e) {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: e.toString(),
        })
      );
    });

    child.stdout.on("data", async (data) => {
      if (data.toString().trim() === ">") {
        if (inputDone) {
          child.stdin.end();
          child.stdout.destroy();
          child.stderr.destroy();
          child.kill();
        } else {
          inputDone = true;
          child.stdin.write(
            `${text}, Once the process is done, make a file at /tmp/td.log. In this file, say either "The test failed" or "The test passed," then explain how you came to that conclusion and the workarounds you tried.\n`
          );
        }
      }

      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stdout",
          message: data.toString(),
        })
      );
    });

    child.stderr.on("data", (data) => {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "stderr",
          message: data.toString(),
        })
      );
    });

    child.on("close", (code) => {
      ipc.server.emit(
        socket,
        JSON.stringify({
          method: "close",
          message: `child process exited with code ${code}`,
        })
      );
    });
  });
});

ipc.server.start();
