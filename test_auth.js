const http = require("http");
let cookie = "";
function req(path, method, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json" };
    if (data) headers["Content-Length"] = Buffer.byteLength(data);
    if (cookie) headers["Cookie"] = cookie;
    const r = http.request({ hostname: "localhost", port: 3000, path, method, headers }, (s) => {
      let d = "";
      s.on("data", c => d += c);
      s.on("end", () => {
        if (s.headers["set-cookie"]) cookie = s.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
        resolve({ status: s.statusCode, body: d });
      });
    });
    r.on("error", (e) => resolve({ status: 0, body: e.message }));
    if (data) r.write(data);
    r.end();
  });
}
(async () => {
  console.log("=== LOGIN ===");
  let r = await req("/api/login", "POST", { email: "demo@sportkick.com", password: "password123" });
  console.log("status:", r.status, "body:", r.body);
  console.log("cookie set:", !!cookie);
  console.log("=== REGISTER (new user) ===");
  r = await req("/api/register", "POST", { name: "Test User", email: "test@example.com", password: "password123" });
  console.log("status:", r.status, "body:", r.body);
  console.log("=== LOGIN with new user ===");
  r = await req("/api/login", "POST", { email: "test@example.com", password: "password123" });
  console.log("status:", r.status, "body:", r.body);
})();
