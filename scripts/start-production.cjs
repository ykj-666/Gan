process.env.NODE_ENV = "production";

const port = process.env.PORT || "3000";
process.env.PORT = port;

import("../dist/boot.js").catch((error) => {
  console.error(error);
  process.exit(1);
});
