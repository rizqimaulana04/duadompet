// Set the disposable URL before test modules instantiate Prisma.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
export {};
