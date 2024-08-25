// import http from 'http'
import express from "express";
import { Server } from "socket.io";

import path from "path";
// import {fileURLToPath} from 'url'
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

//above three line or this single line will same
const __dirname = path.resolve();

const PORT = process.env.PORT || 3500;

const ADMIN = "Admin";

//instance
const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const expressServer = app.listen(PORT, () => {
	// console.log(`listning on port ${PORT}`);
});

//state for user

const UserState = {
	users: [],
	setUsers: function (newUsersArray) {
		this.users = newUsersArray;
	},
};

const io = new Server(expressServer, {
	cors: {
		origin:
			process.env.NODE_ENV === "production"
				? false
				: [
						"http://localhost:3500",
						"http://127.0.0.1:5500",
						"http://192.168.0.138:5501",
				  ],
	},
	//this is above both are same
	// cors: {
	//     origin: '*'
	// }
});

io.on("connection", (socket) => {
	// console.log(`userId: ${socket.id} connected`);

	//Upon connection only to user
	socket.emit("message", buildMsg(ADMIN, "Welcome to Chat App!"));

	socket.on("enterRoom", ({ name, room }) => {
		//leave a previous room
		const prevRoom = getUser(socket.id)?.room;
		if (prevRoom) {
			socket.leave(prevRoom);
			io.to(prevRoom).emit(
				"message",
				buildMsg(ADMIN, `${name} has left the room`)
			);
		}

		const user = activateUser(socket.id, name, room);

		//cannot update previous room users list until after the state update in activate user

		if (prevRoom) {
			io.to(prevRoom).emit("userList", {
				users: getUsersInRoom(prevRoom),
			});
		}

		//join a new room

		socket.join(user.room);

		//To user who joined
		socket.emit(
			"message",
			buildMsg(ADMIN, `You have joined the ${user.room} chat room`)
		);

		//TO everyone else
		socket.broadcast
			.to(user.room)
			.emit("message", buildMsg(ADMIN, `${user.name} has joined the room`));

		//update user list for room
		io.to(user.room).emit("userList", {
			users: getUsersInRoom(user.room),
		});

		//update room list for everyone
		io.emit("roomsList", {
			rooms: getAllActiveRooms(),
		});
	});

	socket.on("disconnect", () => {
		const user = getUser(socket.id);
		userLeaveApp(socket.id);
        if(user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} has left the room`))

            io.to(user.room).emit('userList', {
                users: getUsersInRoom(user.room)
            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        // console.log(`userId: ${socket.id} Dixconnected`);
		
	});

	//upon connection - to all user

	// socket.broadcast.emit("message", `userId: ${socket.id} connected`);

	//listning for a message event

	socket.on("message", ({name, text}) => {
        const room = getUser(socket.id)?.room
        if(room) {
            io.to(room).emit('message', buildMsg(name, text))
        }
		// console.log(data);
		
	});
	//when user disconnect show to all user except he

	// listen for activity
	socket.on("activity", (name) => {
        const room = getUser(socket.id)?.room
        if(room) {
            socket.broadcast.to(room).emit('activity', name)
        }
	});
});

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat("default", {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            timeZone: "Asia/Kolkata"
        }).format(new Date()),
    };
}

//user functions
function activateUser(id, name, room) {
	const user = { id, name, room };
	UserState.setUsers([
		...UserState.users.filter((user) => user.id != id),
		user,
	]);
	return user;
}

function userLeaveApp(id) {
    UserState.setUsers(
        UserState.users.filter(user=> user.id!==id)
    )
}

function getUser(id) {
	return UserState.users.find((user) => user.id === id);
}

function getUsersInRoom(room) {
	return UserState.users.filter((user) => user.room === room);
}

function getAllActiveRooms() {
	//set because don't contain duplicate
	return Array.from(new Set(UserState.users.map((user) => user.room)));
}
