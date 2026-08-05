import app from "./app";
import { up } from "./db/migrate";

const PORT = process.env.PORT || 3000;

async function main(): Promise<void> {
	await up(process.env.DATABASE_URL as string);

	app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
}

main().catch((err) => {
	console.error("Failed to start server", err);
	process.exit(1);
});
