# benbot-engine
There was one day where yeetboi1984 asked me to make a framework for benbot. (i made one)[https://github.com/ThatOneMendes/benbot-engine-v2]. however, i did not put any effort into that at all!!!!!
Anyways here to repent my sins with this.

Example usage:
```js
const {
    BenbotInstance,
} = require("benbot-engine");

const instance = new BenbotInstance(
    "DB_NAME",
    "username",
    "password",
    {
        dialect: "sqlite",
        storage: "./my_db.sqlite",
        logging: false,
    },
    { /* client options*/ },
);

const myCommand = {
    data: {
        "name": "test",
        "description": "test command",
        "options": []
    },
    callback: async (instance, user, interaction) => {
        interaction.reply(`Hello there, ${interaction.user.username}. You have ${user.bencoins} bencoins.`)
        console.log("this command was ran by BenbotInstance:", instance)
    }
}

const mySubcommand = {
    data: {    
        "name": "test_subcommand",
        "description": "when the subcommand goes boom",
        "hasSubcommands": true,
        "subcommands": [
            {
                "name": "kill",
                "description": "blow up this process",
                "options": []
            }
        ]
    },
    callbacks: {
        // every subcommand must have its own callback function. thats the rules here.
        kill: async(instance, user, interaction) => {
            // you get the gist of it.
            process.exit(1984)
        }
    }
}

async function refreshCommands() {
    instance.addCommand(myCommand.data, myCommand.callback)
    instance.addCommand(mySubcommand.data, mySubcommand.callbacks)
    await instance.registerCommands();
}

async function main() {
    await instance.init(
        "BOT_TOKEN",
        "BOT_USER_ID",
    );
    await refreshCommands();
    console.log("Commands refresed. You may go haywire now.");
}

main();
```

Thanks for watching.
