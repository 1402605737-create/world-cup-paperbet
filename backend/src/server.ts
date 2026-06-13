import app from "./app.js";

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`World Cup PaperBet API listening on http://localhost:${port}`);
});

