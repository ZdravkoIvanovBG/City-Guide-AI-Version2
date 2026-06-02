import { Router, type IRouter } from "express";
import { getWeatherForecast } from "../lib/weather";

const router: IRouter = Router();

router.get("/weather", async (req, res): Promise<void> => {
  const { city, country, countryCode = "", startDate, endDate } = req.query as Record<string, string>;
  if (!city || !country || !startDate || !endDate) {
    res.status(400).json({ error: "Missing required query params: city, country, startDate, endDate" });
    return;
  }

  try {
    const forecast = await getWeatherForecast({ city, country, countryCode, startDate, endDate });
    res.json(forecast);
  } catch (err) {
    req.log.error({ err }, "Weather fetch failed");
    res.status(500).json({ error: "Weather service unavailable" });
  }
});

export default router;
