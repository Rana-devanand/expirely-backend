export type NormalizedExternalStore = {
  externalPlaceId: string;

  name: string;
  category: string | null;

  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  openingHours: string | null;
  brand: string | null;

  rawCategories: string[];

  addressText: string | null;

  locality: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;

  latitude: number;
  longitude: number;

  distanceM: number;

  providerData: Record<string, unknown>;
};

/**
 * Geoapify categories used for local vendor discovery.
 */
const CATEGORIES = [
  // General grocery / retail
  "commercial.supermarket",
  "commercial.convenience",
  "commercial.marketplace",
  "commercial.discount_store",
  "commercial.kiosk",

  // Food & grocery stores
  "commercial.food_and_drink.fruit_and_vegetable",
  "commercial.food_and_drink.bakery",
  "commercial.food_and_drink.butcher",
  "commercial.food_and_drink.cheese_and_dairy",
  "commercial.food_and_drink.deli",
  "commercial.food_and_drink.drinks",
  "commercial.food_and_drink.farm",
  "commercial.food_and_drink.frozen_food",
  "commercial.food_and_drink.health_food",
  "commercial.food_and_drink.nuts",
  "commercial.food_and_drink.organic",
  "commercial.food_and_drink.rice",
  "commercial.food_and_drink.spices",
  "commercial.food_and_drink.seafood",
  "commercial.food_and_drink.honey",
  "commercial.food_and_drink.pasta",
  "commercial.food_and_drink.coffee_and_tea",
  "commercial.food_and_drink.confectionery",
  "commercial.food_and_drink.chocolate",

  // Pharmacy / medicine
  "commercial.chemist",
  "commercial.health_and_beauty.pharmacy",
  "healthcare.pharmacy",

  // Pet supplies
  "commercial.pet",
].join(",");

const DEFAULT_FETCH_BUFFER_M = 2500;

const MAX_GEOAPIFY_RADIUS_M = 50000;

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

const DEFAULT_GEOAPIFY_LIMIT = 100;

/**
 * Converts Geoapify categories into an application-friendly label.
 *
 * `switch(true)` is used because Geoapify returns hierarchical category
 * strings rather than one exact category value.
 */
const categoryLabel = (
  categories: unknown,
): string | null => {
  if (!Array.isArray(categories)) {
    return null;
  }

  const values = categories.map((value) =>
    String(value).toLowerCase(),
  );

  const has = (value: string): boolean =>
    values.some((category) =>
      category.includes(value),
    );

  switch (true) {
    // Pharmacy
    case has("pharmacy"):
    case has("chemist"):
      return "Pharmacy";

    // Fresh products
    case has("fruit_and_vegetable"):
      return "Fruits & Vegetables";

    case has("cheese_and_dairy"):
      return "Dairy";

    case has("bakery"):
      return "Bakery";

    case has("butcher"):
      return "Meat & Poultry";

    case has("seafood"):
      return "Seafood";

    // Grocery specialities
    case has("organic"):
      return "Organic Store";

    case has("health_food"):
      return "Health Food";

    case has("frozen_food"):
      return "Frozen Food";

    case has("farm"):
      return "Farm & Fresh Produce";

    case has("rice"):
      return "Rice & Grains";

    case has("spices"):
      return "Spices";

    case has("nuts"):
      return "Dry Fruits & Nuts";

    case has("honey"):
      return "Honey";

    case has("pasta"):
      return "Pasta & Grocery";

    // Drinks
    case has("coffee_and_tea"):
      return "Coffee & Tea";

    case has("drinks"):
      return "Beverages";

    // Sweets
    case has("confectionery"):
    case has("chocolate"):
      return "Sweets & Confectionery";

    // Deli
    case has("deli"):
      return "Deli";

    // Pet supplies
    case has("pet"):
      return "Pet Supplies";

    // General stores
    case has("supermarket"):
      return "Supermarket";

    case has("convenience"):
      return "Convenience Store";

    case has("marketplace"):
      return "Marketplace";

    case has("discount_store"):
      return "Discount Store";

    case has("kiosk"):
      return "Local Store";

    // Generic food category
    case has("food_and_drink"):
      return "Grocery & Food";

    default:
      return "Grocery & Essentials";
  }
};

/**
 * Safely converts a value to a trimmed string.
 */
const stringOrNull = (
  value: unknown,
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
};

/**
 * Normalize opening hours because provider data may be
 * string, array, or object depending on datasource.
 */
const normalizeOpeningHours = (
  value: unknown,
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    return trimmed || null;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean)
      .join("; ");

    return normalized || null;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  return String(value);
};

/**
 * Calculate exact distance between two latitude/longitude
 * points using Haversine formula.
 *
 * Returns meters.
 */
const haversineDistanceM = (
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number => {
  const EARTH_RADIUS_M = 6371000;

  const toRadians = (
    value: number,
  ): number =>
    (value * Math.PI) / 180;

  const lat1 = toRadians(latitude1);

  const lat2 = toRadians(latitude2);

  const deltaLatitude = toRadians(
    latitude2 - latitude1,
  );

  const deltaLongitude = toRadians(
    longitude2 - longitude1,
  );

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLongitude / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return EARTH_RADIUS_M * c;
};

/**
 * Validate user coordinates before making an API request.
 */
const assertCoordinates = (
  latitude: number,
  longitude: number,
): void => {
  if (!Number.isFinite(latitude)) {
    throw new Error(
      "Invalid latitude",
    );
  }

  if (!Number.isFinite(longitude)) {
    throw new Error(
      "Invalid longitude",
    );
  }

  if (
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      "Latitude must be between -90 and 90",
    );
  }

  if (
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Longitude must be between -180 and 180",
    );
  }
};

/**
 * Extract phone number from different Geoapify/OpenStreetMap
 * datasource shapes.
 */
const extractPhone = (
  properties: any,
): string | null =>
  stringOrNull(
    properties?.contact?.phone ??
      properties?.datasource?.raw?.phone ??
      properties?.datasource?.raw
        ?.contact_phone,
  );

/**
 * Extract email.
 */
const extractEmail = (
  properties: any,
): string | null =>
  stringOrNull(
    properties?.contact?.email ??
      properties?.datasource?.raw?.email,
  );

/**
 * Extract business website.
 */
const extractWebsite = (
  properties: any,
): string | null =>
  stringOrNull(
    properties?.contact?.website ??
      properties?.website ??
      properties?.datasource?.raw?.website ??
      properties?.datasource?.raw?.url,
  );

/**
 * Normalize one Geoapify feature into our internal store format.
 */
const normalizeGeoapifyFeature = (
  feature: any,
  originLatitude: number,
  originLongitude: number,
): NormalizedExternalStore | null => {
  const properties =
    feature?.properties ?? {};

  const latitude = Number(
    properties.lat ??
      feature?.geometry
        ?.coordinates?.[1],
  );

  const longitude = Number(
    properties.lon ??
      feature?.geometry
        ?.coordinates?.[0],
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const name = String(
    properties.name ??
      properties.address_line1 ??
      "",
  ).trim();

  const externalPlaceId = String(
    properties.place_id ?? "",
  ).trim();

  if (
    !name ||
    !externalPlaceId
  ) {
    return null;
  }

  const rawCategories =
    Array.isArray(
      properties.categories,
    )
      ? properties.categories.map(
          String,
        )
      : [];

  const fallbackAddress = [
    properties.address_line1,
    properties.address_line2,
  ]
    .filter(Boolean)
    .join(", ")
    .trim();

  const addressText =
    stringOrNull(
      properties.formatted,
    ) ??
    stringOrNull(
      fallbackAddress,
    );

  const distanceM =
    haversineDistanceM(
      originLatitude,
      originLongitude,
      latitude,
      longitude,
    );

  return {
    externalPlaceId,

    name,

    category:
      categoryLabel(
        rawCategories,
      ),

    phone:
      extractPhone(properties),

    email:
      extractEmail(properties),

    websiteUrl:
      extractWebsite(properties),

    openingHours:
      normalizeOpeningHours(
        properties.opening_hours ??
          properties?.datasource?.raw
            ?.opening_hours,
      ),

    brand:
      stringOrNull(
        properties.brand,
      ) ??
      stringOrNull(
        properties?.datasource?.raw
          ?.brand,
      ),

    rawCategories,

    addressText,

    locality:
      stringOrNull(
        properties.suburb,
      ) ??
      stringOrNull(
        properties.district,
      ) ??
      stringOrNull(
        properties.quarter,
      ),

    city:
      stringOrNull(
        properties.city,
      ) ??
      stringOrNull(
        properties.town,
      ) ??
      stringOrNull(
        properties.village,
      ) ??
      stringOrNull(
        properties.county,
      ),

    state:
      stringOrNull(
        properties.state,
      ),

    country:
      stringOrNull(
        properties.country,
      ),

    postalCode:
      stringOrNull(
        properties.postcode,
      ),

    latitude,

    longitude,

    distanceM,

    providerData: {
      provider: "geoapify",

      categories:
        rawCategories,

      datasource:
        properties.datasource ??
        null,

      rank:
        properties.rank ??
        null,

      placeType:
        properties.place_type ??
        null,

      formatted:
        properties.formatted ??
        null,

      attribution:
        "Powered by Geoapify | © OpenStreetMap contributors",
    },
  };
};

/**
 * Generates stable key to prevent duplicate store records.
 */
const storeDeduplicationKey = (
  store: NormalizedExternalStore,
): string => {
  if (
    store.externalPlaceId
  ) {
    return `geoapify:${store.externalPlaceId}`;
  }

  return [
    store.name
      .trim()
      .toLowerCase(),

    store.latitude.toFixed(5),

    store.longitude.toFixed(5),
  ].join("|");
};

/**
 * Remove duplicate stores.
 *
 * If duplicates exist, prefer record with more contact information.
 */
const deduplicateStores = (
  stores: NormalizedExternalStore[],
): NormalizedExternalStore[] => {
  const storeMap =
    new Map<
      string,
      NormalizedExternalStore
    >();

  for (const store of stores) {
    const key =
      storeDeduplicationKey(
        store,
      );

    const existing =
      storeMap.get(key);

    if (!existing) {
      storeMap.set(
        key,
        store,
      );

      continue;
    }

    const existingScore =
      Number(
        Boolean(
          existing.phone,
        ),
      ) +
      Number(
        Boolean(
          existing.email,
        ),
      ) +
      Number(
        Boolean(
          existing.websiteUrl,
        ),
      ) +
      Number(
        Boolean(
          existing.openingHours,
        ),
      );

    const incomingScore =
      Number(
        Boolean(
          store.phone,
        ),
      ) +
      Number(
        Boolean(
          store.email,
        ),
      ) +
      Number(
        Boolean(
          store.websiteUrl,
        ),
      ) +
      Number(
        Boolean(
          store.openingHours,
        ),
      );

    switch (true) {
      case incomingScore >
        existingScore:
        storeMap.set(
          key,
          store,
        );

        break;

      case incomingScore ===
          existingScore &&
        store.distanceM <
          existing.distanceM:
        storeMap.set(
          key,
          store,
        );

        break;

      default:
        break;
    }
  }

  return Array.from(
    storeMap.values(),
  );
};

export type SearchGeoapifyOptions = {
  /**
   * Actual radius that should be returned.
   *
   * 5000 = 5 km
   * 10000 = 10 km
   */
  radiusM: number;

  /**
   * Geoapify can search slightly beyond the real radius,
   * then we filter exact distance locally.
   */
  fetchBufferM?: number;

  /**
   * Geoapify result limit.
   */
  limit?: number;

  /**
   * Request timeout.
   */
  timeoutMs?: number;
};

/**
 * Main method matching your original function signature.
 */
export const searchGeoapifyStores =
  async (
    latitude: number,
    longitude: number,
    radiusM: number,
    apiKey: string,
  ): Promise<
    NormalizedExternalStore[]
  > => {
    return searchGeoapifyStoresWithOptions(
      latitude,
      longitude,
      apiKey,
      {
        radiusM,
      },
    );
  };

/**
 * Advanced Geoapify search.
 */
export const searchGeoapifyStoresWithOptions =
  async (
    latitude: number,
    longitude: number,
    apiKey: string,
    options: SearchGeoapifyOptions,
  ): Promise<
    NormalizedExternalStore[]
  > => {
    assertCoordinates(
      latitude,
      longitude,
    );

    if (!apiKey?.trim()) {
      throw new Error(
        "Geoapify API key is required",
      );
    }

    if (
      !Number.isFinite(
        options.radiusM,
      ) ||
      options.radiusM <= 0
    ) {
      throw new Error(
        "radiusM must be greater than 0",
      );
    }

    /**
     * User's real search radius.
     */
    const requestedRadiusM =
      Math.max(
        100,
        Math.min(
          options.radiusM,
          MAX_GEOAPIFY_RADIUS_M,
        ),
      );

    /**
     * Extra Geoapify fetch radius.
     *
     * Example:
     *
     * user radius = 5000
     * fetch radius = 7500
     *
     * But results are filtered back to 5000 below.
     */
    const fetchBufferM =
      Math.max(
        0,
        options.fetchBufferM ??
          DEFAULT_FETCH_BUFFER_M,
      );

    const searchRadiusM =
      Math.min(
        requestedRadiusM +
          fetchBufferM,

        MAX_GEOAPIFY_RADIUS_M,
      );

    /**
     * Limit protection.
     */
    const limit =
      Math.max(
        1,
        Math.min(
          options.limit ??
            DEFAULT_GEOAPIFY_LIMIT,

          500,
        ),
      );

    const timeoutMs =
      Math.max(
        1000,
        options.timeoutMs ??
          DEFAULT_REQUEST_TIMEOUT_MS,
      );

    const params =
      new URLSearchParams({
        categories:
          CATEGORIES,

        filter:
          `circle:${longitude},${latitude},${searchRadiusM}`,

        bias:
          `proximity:${longitude},${latitude}`,

        limit:
          String(limit),

        lang:
          "en",

        apiKey,
      });

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),

        timeoutMs,
      );

    try {
      const response =
        await fetch(
          `https://api.geoapify.com/v2/places?${params.toString()}`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/geo+json",
            },

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        let errorBody =
          "";

        try {
          errorBody =
            await response.text();
        } catch {
          errorBody =
            "";
        }

        throw new Error(
          `Geoapify returned HTTP ${response.status}${
            errorBody
              ? `: ${errorBody.slice(
                  0,
                  300,
                )}`
              : ""
          }`,
        );
      }

      const payload =
        (await response.json()) as {
          features?: unknown[];
        };

      if (
        !Array.isArray(
          payload?.features,
        )
      ) {
        throw new Error(
          "Geoapify returned an invalid response",
        );
      }

      const stores: NormalizedExternalStore[] =
        [];

      for (
        const feature of
        payload.features
      ) {
        const store =
          normalizeGeoapifyFeature(
            feature,
            latitude,
            longitude,
          );

        if (!store) {
          continue;
        }

        /**
         * We searched with buffer,
         * but only return stores
         * inside user's selected radius.
         */
        if (
          store.distanceM >
          requestedRadiusM
        ) {
          continue;
        }

        stores.push(
          store,
        );
      }

      /**
       * Remove duplicates.
       */
      const deduplicated =
        deduplicateStores(
          stores,
        );

      /**
       * Closest vendor first.
       */
      deduplicated.sort(
        (storeA, storeB) =>
          storeA.distanceM -
          storeB.distanceM,
      );

      return deduplicated;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        throw new Error(
          `Geoapify request timed out after ${timeoutMs}ms`,
        );
      }

      throw error;
    } finally {
      clearTimeout(
        timeout,
      );
    }
  };

/**
 * Optional utility for UI.
 *
 * 250   -> "250 m"
 * 1250  -> "1.3 km"
 */
export const formatStoreDistance =
  (
    distanceM: number,
  ): string => {
    switch (true) {
      case !Number.isFinite(
        distanceM,
      ):
        return "";

      case distanceM < 0:
        return "";

      case distanceM <
        1000:
        return `${Math.round(
          distanceM,
        )} m`;

      default:
        return `${(
          distanceM / 1000
        ).toFixed(1)} km`;
    }
  };