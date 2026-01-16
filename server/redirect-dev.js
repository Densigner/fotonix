// redirect-dev.js
const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cookieParser());

app.get("/r/:affId/:productId", (req, res) => {
  const { affId, productId } = req.params;
  const clickId = Date.now().toString(36); // stubbed click id
  // Set a 30-day cookie. Secure + SameSite=Lax for "realistic" behavior.
  res.cookie("fotonix_aff", `${affId}:${clickId}`, {
    httpOnly: true,
    secure: true,         // will work because ngrok gives you HTTPS
    sameSite: "lax",
    maxAge: 30 * 24 * 3600 * 1000,
  });
  // Redirect to your local React app product page
  res.redirect(302, `http://localhost:3000/product/${productId}`);
});

app.listen(8787, () => console.log("Redirect dev on http://localhost:8787"));