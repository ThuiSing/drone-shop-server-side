const express = require("express");
const { MongoClient } = require("mongodb");
const admin = require("firebase-admin");
const cors = require("cors");
const ObjectId = require("mongodb").ObjectId;
require("dotenv").config();
const fileupload = require("express-fileupload");
const port = process.env.PORT || 5000;

const app = express();
//middleware
app.use(cors());
app.use(express.json());
app.use(fileupload());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//database
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hoxgz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// check admin
const verifyToken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodeUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodeUser.email;
    } catch (err) {}
  }
  next();
};

// connect to database
const run = async () => {
  try {
    await client.connect();
    const database = client.db("Drone_Shop");
    const usersCollection = database.collection("Users");
    const dronesCollection = database.collection("Drones");
    const ordersCollection = database.collection("Orders");
    const reviewsCollection = database.collection("Reviews");
    const cartsCollection = database.collection("cart");

    //get users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await usersCollection.findOne(filter);
      // console.log(user.role);
      let admin;
      if (user?.role === "Admin") {
        admin = true;
      } else {
        admin = false;
      }
      res.json({ isAdmin: admin });
    });
    app.post("/users", async (req, res) => {
      const doc = req.body;
      console.log(doc);
      const result = await usersCollection.insertOne(doc);
      res.json(result);
    });
    app.put("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user?.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.json(result);
    });
    // make admin
    app.put("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (req.decodedEmail) {
        const requesterAcc = await usersCollection.findOne({
          email: req.decodedEmail,
        });
        if (requesterAcc?.role === "Admin") {
          const query = { email: email };
          const doc = { $set: { role: "Admin" } };
          const result = await usersCollection.updateOne(query, doc);
          res.json(result);
        }
        // console.log(requesterAcc);
      } else {
        res.status(403).json({ message: "nice try! Have a nice day !" });
      }
    });

    //get all drones
    app.get("/drones", async (req, res) => {
      const result = await dronesCollection.find({}).toArray();
      res.send(result);
    });
    //get specific drone
    app.get("/drones/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await dronesCollection.findOne(query);
      res.send(result);
    });
    app.post("/drones", async (req, res) => {
      const drone = req.body;
      const name = drone.name;
      const description = drone.description;
      const price = drone.price;
      const image = req.files.img;
      const imgBase64 = image.data.toString("base64");
      const bufferedImg = Buffer.from(imgBase64, "base64");

      const doc = {
        name,
        description,
        price,
        img: bufferedImg,
      };
      const result = await dronesCollection.insertOne(doc);
      res.json(result);
    });
    app.put("/drones/:id", async (req, res) => {
      const id = req.params.id;

      const drone = req.body;
      // console.log(drone);
      const name = drone.name;
      const description = drone.description;
      const price = drone.price;
      const image = req.files.img;
      const imgBase64 = image.data.toString("base64");
      const bufferedImg = Buffer.from(imgBase64, "base64");

      const doc = {
        name,
        description,
        price,
        img: bufferedImg,
      };
      const filter = { _id: ObjectId(id) };
      const updatedDoc = { $set: doc };
      const result = await dronesCollection.updateOne(filter, updatedDoc);
      res.json(result);
    });
    app.delete("/drones/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await dronesCollection.deleteOne(filter);
      res.json(result);
    });

    //get all orders & specific orders
    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      let result;
      if (email) {
        result = await ordersCollection.find(filter).toArray();
      } else {
        result = await ordersCollection.find().toArray();
      }
      res.send(result);
    });
    //sent database ordered item
    app.post("/orders", async (req, res) => {
      const doc = req.body;
      const checkMany = Array.isArray(doc);
      let result;
      if (checkMany) {
        result = await ordersCollection.insertMany(doc);
      } else {
        result = await ordersCollection.insertOne(doc);
      }
      res.json(result);
    });
    //update order
    app.put("/orders", async (req, res) => {
      const doc = req.body;
      const id = doc._id;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          status: doc.status,
        },
      };
      const result = await ordersCollection.updateOne(filter, updateDoc);
      res.json(result);
    });
    //delete order using id
    app.delete("/orders/:id", async (req, res) => {
      // console.log(req.params.id);
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      // console.log(filter);
      const result = await ordersCollection.deleteOne(filter);
      res.json(result);
    });

    //cart
    app.get("/cart/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await cartsCollection.findOne(query);
      res.send(result);
    });
    app.put("/cart", async (req, res) => {
      const addedCart = req.body;
      const query = { email: addedCart?.email };
      const options = { upsert: true };
      const updateDoc = { $set: addedCart };
      const result = await cartsCollection.updateOne(query, updateDoc, options);
      // console.log(result);
      res.json(result);
    });
    app.delete("/cart/:email", async (req, res) => {
      const email = req.params.email;
      // console.log(email);
      const query = { email: email };
      const result = await cartsCollection.deleteMany(query);
      res.json(result);
    });

    //review
    //get review
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find({}).toArray();
      res.send(result);
    });
    //post review
    app.post("/reviews", async (req, res) => {
      const reviewDoc = req.body;
      const result = await reviewsCollection.insertOne(reviewDoc);
      res.json(result);
    });
  } finally {
    // await client.close();
  }
};
run().catch(console.dir);

//home page
app.get("/", (req, res) => {
  res.send("Drone Shop Server is Running.....");
});
app.listen(port, () => {
  console.log("running server on ", port);
});
