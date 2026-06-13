import app from "./app.js";

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`世界杯纸上竞猜后端服务正在监听 http://localhost:${port}`);
});
