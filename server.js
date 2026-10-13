require("dotenv").config();
const { app } = require("./app");

const port = process.env.PORT;

(async () => {
  const PORT = port || 5000;
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server running on port ${PORT}`),
  );
})();
