/**
 * Loads public/js/code.js into the current jsdom document without changing
 * the production file. code.js is a plain browser script (no modules), so we
 * wrap its source in a function and pass in test doubles for the browser
 * globals it touches (window.location, XMLHttpRequest, md5).
 *
 * The returned object exposes code.js's functions plus getters/setters for its
 * module-level state (userId, firstName, lastName) so tests can inspect it.
 */
const fs = require("fs");
const path = require("path");

const CODE_JS = fs.readFileSync(
	path.join(__dirname, "..", "..", "public", "js", "code.js"),
	"utf8"
);

/** Minimal XMLHttpRequest double that records each request. */
function createFakeXhrClass()
{
	const requests = [];

	class FakeXHR
	{
		constructor()
		{
			this.headers = {};
			this.readyState = 0;
			this.status = 0;
			this.responseText = "";
			this.onreadystatechange = null;
			requests.push(this);
		}

		open(method, url, async)
		{
			this.method = method;
			this.url = url;
			this.async = async;
		}

		setRequestHeader(name, value)
		{
			this.headers[name] = value;
		}

		send(body)
		{
			this.body = body;
		}

		/** Simulates the server responding to this request. */
		respond(status, json)
		{
			this.readyState = 4;
			this.status = status;
			this.responseText = typeof json === "string" ? json : JSON.stringify(json);
			if (this.onreadystatechange)
			{
				this.onreadystatechange.call(this);
			}
		}
	}

	return { FakeXHR, requests };
}

function loadCodeJs({ md5 = (s) => `md5(${s})` } = {})
{
	const { FakeXHR, requests } = createFakeXhrClass();
	const fakeWindow = { location: { href: "" } };

	const factory = new Function(
		"window",
		"document",
		"XMLHttpRequest",
		"md5",
		`${CODE_JS}
		return {
			doLogin, saveCookie, readCookie, doLogout, addColor, searchColor,
			urlBase, extension,
			get userId() { return userId; },
			set userId(v) { userId = v; },
			get firstName() { return firstName; },
			set firstName(v) { firstName = v; },
			get lastName() { return lastName; },
			set lastName(v) { lastName = v; },
		};`
	);

	const app = factory(fakeWindow, document, FakeXHR, md5);
	return { app, window: fakeWindow, requests };
}

/** Clears every cookie jsdom is holding so tests don't leak into each other. */
function clearCookies()
{
	document.cookie.split(";").forEach((c) =>
	{
		const name = c.split("=")[0].trim();
		if (name)
		{
			document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
		}
	});
}

module.exports = { loadCodeJs, clearCookies };
