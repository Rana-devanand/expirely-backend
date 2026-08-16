const enabled = (value: string | undefined) => value?.trim().toLowerCase() === "true";

export const vendorFlags = {
  marketplace: () => enabled(process.env.ENABLE_VENDOR_MARKETPLACE),
  discovery: () => enabled(process.env.ENABLE_VENDOR_DISCOVERY),
  externalDiscovery: () => enabled(process.env.ENABLE_VENDOR_EXTERNAL_DISCOVERY),
};

export const publicVendorFlags = () => ({
  marketplaceEnabled: vendorFlags.marketplace(),
  discoveryEnabled: vendorFlags.marketplace() && vendorFlags.discovery(),
});
