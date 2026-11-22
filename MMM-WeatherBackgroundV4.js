/* MagicMirror² Module: MMM-WeatherBackgroundV4
 * Shows a full-screen photo that matches the current weather, day or night.
 * Works with MMM-NOAAV4 (and the older MMM-NOAA3) through their "WEATHER" notification.
 * By cowboysdude. MIT Licensed.
 */

/* global Module, Log */

Module.register("MMM-WeatherBackgroundV4", {
	defaults: {
		notification: "WEATHER",          // notification sent by MMM-NOAAV4
		targetDOM: ".region.fullscreen.below", // where the photo is drawn (behind everything)
		opacity: 0.3,                     // darkness of the box behind each module (0 = none, 1 = black)
		modulePadding: "10px",            // padding inside those boxes
		moduleBackground: true,           // false = don't put a dark box behind modules
		noBox: ["MMM-NOAAV4", "MMM-NEO"], // modules that get no dark box (they draw their own card)
		fitBoxes: true,                   // true = each box hugs its module | false = box fills the module's whole slot
		fadeSpeed: 2,                     // seconds for the photo to fade to the next one
		images: {}                        // your own pictures, e.g. { "rain": "my-rain.jpg", "n_rain": "my-night-rain.jpg" }
	},

	// Every icon name MMM-NOAAV4 can send -> picture in photos/ (day / night)
	iconMap: {
		clear:          ["clear.jpg",        "n_clear.jpg"],
		sunny:          ["clear.jpg",        "n_clear.jpg"],
		mostlysunny:    ["partlycloudy.jpg", "n_partlycloudy.jpg"],
		mostlyclear:    ["partlycloudy.jpg", "n_partlycloudy.jpg"],
		partlysunny:    ["partlycloudy.jpg", "n_partlycloudy.jpg"],
		partlycloudy:   ["partlycloudy.jpg", "n_partlycloudy.jpg"],
		mostlycloudy:   ["mostlycloudy.jpg", "n_mostlycloudy.jpg"],
		cloudy:         ["cloudy.jpg",       "n_cloudy.jpg"],
		overcast:       ["overcast.jpg",     "n_overcast.jpg"],
		wind:           ["cloudy.jpg",       "n_cloudy.jpg"],
		breezy:         ["partlycloudy.jpg", "n_partlycloudy.jpg"],
		fog:            ["fog.jpg",          "n_fog.jpg"],
		hazy:           ["hazy.jpg",         "n_hazy.jpg"],
		drizzle:        ["drizzle.jpg",      "n_rain.jpg"],
		chancerain:     ["chancerain.jpg",   "n_rain.jpg"],
		rain:           ["rain.jpg",         "n_rain.jpg"],
		chancetstorms:  ["tstorms.jpg",      "n_tstorms.jpg"],
		tstorms:        ["tstorms.jpg",      "n_tstorms.jpg"],
		sleet:          ["sleet.jpg",        "n_sleet.jpg"],
		chancesleet:    ["sleet.jpg",        "n_sleet.jpg"],
		flurries:       ["flurries.jpg",     "n_flurries.jpg"],
		chanceflurries: ["flurries.jpg",     "n_flurries.jpg"],
		chancesnow:     ["chancesnow.jpg",   "n_chancesnow.jpg"],
		snow:           ["snow.jpg",         "n_snow.jpg"]
	},

	start () {
		this.icon = null;
		this.sunrise = null;
		this.sunset = null;
		this.isDay = null;
		this.shown = null;
		// re-check every minute so the photo switches at sunrise/sunset, not just when new weather arrives
		this.timer = setInterval(() => this.update(), 60 * 1000);
	},

	getStyles () {
		return [this.file("MMM-WeatherBackgroundV4.css")];
	},

	notificationReceived (notification, payload) {
		if (notification === "DOM_OBJECTS_CREATED") {
			this.applyModuleBoxes();
			return;
		}
		if (notification !== this.config.notification || !payload) return;
		this.icon = payload.icon || null;
		this.sunrise = payload.sunrise ? Date.parse(payload.sunrise) : null;
		this.sunset = payload.sunset ? Date.parse(payload.sunset) : null;
		this.isDay = typeof payload.isDay === "boolean" ? payload.isDay : null;
		this.update();
	},

	night () {
		const now = Date.now();
		if (this.sunrise && this.sunset) return now < this.sunrise || now >= this.sunset;
		if (this.sunset) {
			// only sunset is known (older MMM-NOAA3): night after sunset, or before 6 am
			return now >= this.sunset || new Date().getHours() < 6;
		}
		if (this.isDay !== null) return !this.isDay;
		const h = new Date().getHours();
		return h < 6 || h >= 18;
	},

	pictureFor (icon, night) {
		const key = String(icon || "").toLowerCase().replace(/^nt_/, "");
		const own = this.config.images || {};
		if (night && own[`n_${key}`]) return own[`n_${key}`];
		if (own[key]) return own[key];
		const pair = this.iconMap[key];
		if (!pair) return null;
		return this.file(`photos/${night ? pair[1] : pair[0]}`);
	},

	update () {
		if (!this.icon) return;
		const picture = this.pictureFor(this.icon, this.night());
		if (!picture) {
			Log.warn(`[MMM-WeatherBackgroundV4] No picture for "${this.icon}", keeping the current one.`);
			return;
		}
		if (picture === this.shown) return;
		const targets = document.querySelectorAll(this.config.targetDOM);
		if (!targets.length) {
			Log.warn(`[MMM-WeatherBackgroundV4] Nothing on the page matches "${this.config.targetDOM}".`);
			return;
		}
		// load first, then swap, so the screen never flashes empty
		const img = new Image();
		img.onload = () => {
			targets.forEach((el) => {
				el.classList.add("weather-background");
				el.style.transition = `background-image ${this.config.fadeSpeed}s ease`;
				el.style.backgroundImage = `url("${picture}")`;
			});
			this.shown = picture;
		};
		img.onerror = () => Log.warn(`[MMM-WeatherBackgroundV4] Could not load ${picture}`);
		img.src = picture;
	},

	applyModuleBoxes () {
		if (!this.config.moduleBackground) return;
		const style = document.createElement("style");
		const skip = ["MMM-WeatherBackgroundV4", ...(this.config.noBox || [])]
			.map((n) => `:not(.${String(n).replace(/[^\w-]/g, "")})`).join("");
		const box = `.module${skip}`;
		let css = `${box} {
			background-color: rgba(0, 0, 0, ${Number(this.config.opacity)});
			padding: ${this.config.modulePadding};
		}`;
		if (this.config.fitBoxes) {
			// shrink each box to its module, keeping it on its side of the screen;
			// the full-width bars (like a news ticker) keep their full width
			css += `
			${box} { box-sizing: border-box; width: fit-content; max-width: 100%; }
			.region.right ${box} { margin-left: auto; }
			.region.center ${box}, .region.third ${box} { margin-left: auto; margin-right: auto; }
			.region.bar ${box} { width: auto; }`;
		}
		style.textContent = css;
		document.head.appendChild(style);
	},

	suspend () {
		clearInterval(this.timer);
	},

	resume () {
		clearInterval(this.timer);
		this.timer = setInterval(() => this.update(), 60 * 1000);
		this.update();
	}
});
