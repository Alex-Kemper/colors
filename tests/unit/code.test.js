/**
 * Front-end unit tests for public/js/code.js.
 * Runs in jsdom; all network calls go to a fake XMLHttpRequest, so no server
 * is needed.
 */
const fs = require("fs");
const path = require("path");
const { loadCodeJs, clearCookies } = require("../helpers/loadCodeJs");

const INDEX_HTML = fs.readFileSync(path.join(__dirname, "..", "..", "public", "index.html"), "utf8");
const COLOR_HTML = fs.readFileSync(path.join(__dirname, "..", "..", "public", "color.html"), "utf8");

/** Loads a page's <body> markup into jsdom (scripts are not executed). */
function usePage(html)
{
	const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];
	document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, "");
}

afterEach(() =>
{
	clearCookies();
	document.body.innerHTML = "";
});

describe("saveCookie / readCookie", () =>
{
	test("saveCookie writes the logged-in user's name and id into the cookie", () =>
	{
		const { app } = loadCodeJs();
		app.firstName = "Sam";
		app.lastName = "Hill";
		app.userId = 2;

		app.saveCookie();

		expect(document.cookie).toContain("firstName=Sam,lastName=Hill,userId=2");
	});

	test("readCookie restores user state from a cookie written by saveCookie", () =>
	{
		const writer = loadCodeJs().app;
		writer.firstName = "Aashish";
		writer.lastName = "Yadavally";
		writer.userId = 1;
		writer.saveCookie();

		const { app, window } = loadCodeJs();
		app.readCookie();

		expect(app.userId).toBe(1);
		expect(app.firstName).toBe("Aashish");
		expect(app.lastName).toBe("Yadavally");
		expect(window.location.href).toBe("");
	});

	test("readCookie sends the user back to the login page when there is no session", () =>
	{
		const { app, window } = loadCodeJs();

		app.readCookie();

		expect(app.userId).toBe(-1);
		expect(window.location.href).toBe("index.html");
	});

	test("doLogout clears user state and returns to the login page", () =>
	{
		const { app, window } = loadCodeJs();
		app.userId = 5;
		app.firstName = "A";
		app.lastName = "B";

		app.doLogout();

		expect(app.userId).toBe(0);
		expect(app.firstName).toBe("");
		expect(app.lastName).toBe("");
		expect(window.location.href).toBe("index.html");
	});
});

describe("doLogin", () =>
{
	beforeEach(() => usePage(INDEX_HTML));

	function fillLogin(login, password)
	{
		document.getElementById("loginName").value = login;
		document.getElementById("loginPassword").value = password;
	}

	test("POSTs the login and MD5-hashed password as JSON to Login.php", () =>
	{
		const md5 = jest.fn(() => "5832a71366768098cceb7095efb774f2");
		const { app, requests } = loadCodeJs({ md5 });
		fillLogin("AYadavally", "COP4331");

		app.doLogin();

		expect(md5).toHaveBeenCalledWith("COP4331");
		expect(requests).toHaveLength(1);
		const req = requests[0];
		expect(req.method).toBe("POST");
		expect(req.url).toBe(`${app.urlBase}/Login.${app.extension}`);
		expect(req.headers["Content-type"]).toMatch(/application\/json/);
		expect(JSON.parse(req.body)).toEqual({
			login: "AYadavally",
			password: "5832a71366768098cceb7095efb774f2",
		});
	});

	test("on success, stores the user and redirects to color.html", () =>
	{
		const { app, window, requests } = loadCodeJs();
		fillLogin("SamH", "Test");
		app.doLogin();

		requests[0].respond(200, { id: 2, firstName: "Sam", lastName: "Hill", error: "" });

		expect(app.userId).toBe(2);
		expect(app.firstName).toBe("Sam");
		expect(document.cookie).toContain("userId=2");
		expect(window.location.href).toBe("color.html");
	});

	test("on bad credentials, shows an error and does not redirect", () =>
	{
		const { app, window, requests } = loadCodeJs();
		fillLogin("nobody", "wrong");
		app.doLogin();

		requests[0].respond(200, { id: 0, firstName: "", lastName: "", error: "No Records Found" });

		expect(document.getElementById("loginResult").innerHTML).toBe("User/Password combination incorrect");
		expect(window.location.href).toBe("");
		expect(document.cookie).not.toContain("userId=");
	});
});

describe("addColor", () =>
{
	beforeEach(() => usePage(COLOR_HTML));

	test("POSTs the new color with the current user's id and confirms success", () =>
	{
		const { app, requests } = loadCodeJs();
		app.userId = 1;
		document.getElementById("colorText").value = "Teal";

		app.addColor();

		expect(requests[0].url).toBe(`${app.urlBase}/AddColor.${app.extension}`);
		expect(JSON.parse(requests[0].body)).toEqual({ color: "Teal", userId: 1 });
		expect(document.getElementById("colorAddResult").innerHTML).toBe("");

		requests[0].respond(200, { error: "" });

		expect(document.getElementById("colorAddResult").innerHTML).toBe("Color has been added");
	});
});

describe("searchColor", () =>
{
	beforeEach(() => usePage(COLOR_HTML));

	test("POSTs the search term and renders each result on its own line", () =>
	{
		const { app, requests } = loadCodeJs();
		app.userId = 1;
		document.getElementById("searchText").value = "light";

		app.searchColor();

		expect(requests[0].url).toBe(`${app.urlBase}/SearchColors.${app.extension}`);
		expect(JSON.parse(requests[0].body)).toEqual({ search: "light", userId: 1 });

		requests[0].respond(200, { results: ["Light Blue", "Light Gray", "Light Red"], error: "" });

		expect(document.getElementById("colorSearchResult").innerHTML).toBe("Color(s) has been retrieved");
		const lines = document.getElementById("colorList").innerHTML.split(/<br\s*\/?>\s*/);
		expect(lines).toEqual(["Light Blue", "Light Gray", "Light Red"]);
	});

	test("does nothing to the page until the server responds with 200", () =>
	{
		const { app, requests } = loadCodeJs();
		document.getElementById("searchText").value = "blue";
		app.searchColor();

		requests[0].respond(500, "Internal Server Error");

		expect(document.getElementById("colorSearchResult").innerHTML).toBe("");
	});
});
