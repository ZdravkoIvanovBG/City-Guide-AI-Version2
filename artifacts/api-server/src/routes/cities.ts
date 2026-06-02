import { Router, type IRouter } from "express";
import { getCityAutocomplete } from "../lib/gemini";
import { getPlacePhoto } from "../lib/placePhoto";
import {
  GetCityAutocompleteQueryParams,
  GetCityPhotoQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cities/autocomplete", async (req, res): Promise<void> => {
  const parsed = GetCityAutocompleteQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  const { q } = parsed.data;
  if (!q || q.trim().length < 1) {
    res.status(400).json({ error: "Query too short" });
    return;
  }

  try {
    const suggestions = await getCityAutocomplete(q);
    res.json(suggestions);
  } catch (err) {
    req.log.error({ err }, "City autocomplete failed");
    res.status(500).json({ error: "Autocomplete service unavailable" });
  }
});

router.get("/cities/photo", async (req, res): Promise<void> => {
  const parsed = GetCityPhotoQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing query parameter 'q'" });
    return;
  }

  const { q } = parsed.data;
  try {
    const photoUrl = await getPlacePhoto(q);
    res.json({ photoUrl });
  } catch (err) {
    req.log.error({ err }, "City photo fetch failed");
    res.status(500).json({ error: "Photo service unavailable" });
  }
});

export default router;
