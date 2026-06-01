const { MongoClient } = require("mongodb");

const uri =
"mongodb+srv://injamamulhoqtamim_db_user:Pp12345678@cluster0.vixw6gg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function test() {
  try {
    const client = new MongoClient(uri);

    await client.connect();

    console.log("✅ CONNECTED");

    await client.close();

  } catch (err) {
    console.log("❌ FAILED");
    console.log(err);
  }
}

test();