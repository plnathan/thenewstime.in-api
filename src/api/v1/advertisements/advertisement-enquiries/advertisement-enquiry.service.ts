import type { AdvertisementEnquiryRepository } from "./advertisement-enquiry.repository.js";
import type { CreateAdvertisementEnquiryInput } from "./advertisement-enquiry.validation.js";

export function createAdvertisementEnquiryService(
  repository: AdvertisementEnquiryRepository
) {
  return {
    async submit(input: CreateAdvertisementEnquiryInput) {
      // Never create an advertisement or client automatically from a public enquiry.
      return repository.create(input);
    }
  };
}
