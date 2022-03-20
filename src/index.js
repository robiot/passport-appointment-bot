const locations = require("./locations");
const regions = require("./regions");
const logger = require("./logger");
const tracker = require("./tracker");
const config = require("../config.json");
const validateConfig = require("./validateConfig");
const bookingService = require("./bookingService")(config.region);

const locationQueue = [];
// const bookingService = createBookingService(config.region);

(async () => {
  validateConfig();

  logger.info("Validating provided region...");
  if (!(config.region in regions)) {
    logger.error(`Region not supported: ${config.region}, exiting...`);
    process.exit();
  }
  logger.log("success", "Valid region");

  logger.info("Validating provided locations...");
  for (const location of config.locations) {
    if (locations[location]) {
      locationQueue.push(locations[location]);
    } else {
      logger.error(`Location not found: ${location}, skipping...`);
    }
  }

  await bookingService.initSession();

  tracker.init();

  logger.log("success", "Starting to check for available timeslots");
  checkAvailableSlotsForLocation(locationQueue[0]);
})();

const checkAvailableSlotsForLocation = async (location) => {
  logger.info(`Switching to location: ${location}`);
  const maxDate = new Date(config.max_date);
  const currentDate = new Date();

  while (currentDate.getTime() < maxDate.getTime()) {
    const [freeSlots, bookedSlots] = await bookingService.getFreeSlotsForWeek(
      locationQueue[0],
      currentDate
    );

    if (freeSlots.length && freeSlots.length > 0) {
      logger.log("success", `Free timeslots found: ${freeSlots.length}`);

      const parent = freeSlots[0].parent;
      const serviceTypeId = parent.attribs["data-servicetypeid"];
      const timeslot = parent.attribs["data-fromdatetime"];

      const booking = await bookingService.bookSlot(
        serviceTypeId,
        timeslot,
        location,
        config
      );
      if (booking) {
        logger.log("success", "Booking successful:");
        logger.log("success", `Booking number: \t\t ${booking.bookingNumber}`);
        logger.log("success", `Time: \t\t ${booking.slot}`);
        logger.log("success", `Location: \t\t ${booking.expedition}`);
        logger.log("success", `Email: \t\t ${config.email}`);
        logger.log("success", `Phone: \t\t ${config.phone}`);
        process.exit();
      } else {
        logger.error(`Failed booking slot ${timeslot}`);
      }
    } else {
      logger.verbose(`No free timeslots found, ${bookedSlots.length} reserved`);
    }

    tracker.track();
    addDays(currentDate);
  }
  logger.verbose("Max date reached, checking next location...");

  locationQueue.push(locationQueue.shift());
  checkAvailableSlotsForLocation(locationQueue[0]);
};

const addDays = (date) => {
  date.setDate(date.getDate() + 7);
};
