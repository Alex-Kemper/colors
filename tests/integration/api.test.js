/**
 * Integration tests for the PHP API (api/*.php) against a real MySQL database.
 *
 * Node/Jest is only the test runner here: the app itself is served by PHP
 * (`php -S`) talking to MySQL seeded from db/schema.sql. In CI the workflow
 * starts both before running these tests; locally, point API_BASE_URL at any
 * running copy of the API.
 */
const API_BASE_URL = (process.env.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// MD5 hashes of the seeded test passwords (see db/schema.sql)
const COP4331_MD5 = "5832a71366768098cceb7095efb774f2";
const TEST_MD5 = "0cbc6611f5540bd0809a388dc95a615b";

/** POSTs JSON to an endpoint and returns the status, headers and parsed body. */
async function post(endpoint, payload)
{
	const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=UTF-8" },
		body: JSON.stringify(payload),
	});
	const text = await res.text();
	let json;
	try
	{
		json = JSON.parse(text);
	}
	catch
	{
		throw new Error(`${endpoint} did not return valid JSON. Got:\n${text}`);
	}
	return { status: res.status, contentType: res.headers.get("content-type"), json };
}

describe("Login.php", () =>
{
	test("returns the user's id and name as JSON for valid credentials", async () =>
	{
		const { status, contentType, json } = await post("Login.php", {
			login: "AYadavally",
			password: COP4331_MD5,
		});

		expect(status).toBe(200);
		expect(contentType).toMatch(/application\/json/);
		expect(json).toEqual({ id: expect.any(Number), firstName: "Aashish", lastName: "Yadavally", error: "" });
		expect(json.id).toBeGreaterThan(0);
	});

	test("returns id 0 and an error for a wrong password", async () =>
	{
		const { status, json } = await post("Login.php", { login: "AYadavally", password: TEST_MD5 });

		expect(status).toBe(200);
		expect(json).toEqual({ id: 0, firstName: "", lastName: "", error: "No Records Found" });
	});
});

describe("SearchColors.php", () =>
{
	test("returns only the matching colors that belong to the user", async () =>
	{
		const { json } = await post("SearchColors.php", { search: "light", userId: 1 });

		expect(json.error).toBe("");
		expect(Array.isArray(json.results)).toBe(true);
		expect(json.results).toEqual(
			expect.arrayContaining(["Light Blue", "Light Gray", "Light Red", "Light Green"])
		);
		json.results.forEach((name) => expect(name.toLowerCase()).toContain("light"));
	});

	test("does not return another user's colors", async () =>
	{
		const { json } = await post("SearchColors.php", { search: "Salmon", userId: 2 });

		expect(json.error).toBe("No Records Found");
		expect(json.results).toBeUndefined();
	});
});

describe("AddColor.php + SearchColors.php", () =>
{
	test("a color added for a user can then be found by searching", async () =>
	{
		const colorName = `CI-Test-${Date.now()}`;

		const add = await post("AddColor.php", { color: colorName, userId: 2 });
		expect(add.status).toBe(200);
		expect(add.contentType).toMatch(/application\/json/);
		expect(add.json).toEqual({ error: "" });

		const search = await post("SearchColors.php", { search: colorName, userId: 2 });
		expect(search.json).toEqual({ results: [colorName], error: "" });

		const otherUser = await post("SearchColors.php", { search: colorName, userId: 1 });
		expect(otherUser.json.error).toBe("No Records Found");
	});
});
