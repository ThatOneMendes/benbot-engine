const { Sequelize, DataTypes } = require("sequelize");
const userModelJSON = require("./config/user_model_attributes.json");
const copyObject = require("./utils/copy_object.js");
const assert = require("./utils/assert.js");
const {
    User: DiscordUser,
    Client,
    Collection,
    SlashCommandBuilder,
    SlashCommandSubcommandGroupBuilder,
    SlashCommandSubcommandBuilder,
    REST,
    Routes,
} = require("discord.js");
const ITEM_FLAGS = require("./config/item_flags.js");

/**
 * @callback BenbotInteractionCallback
 * @param {BenbotInstance} instance
 * @param {import('discord.js').Interaction} interaction
 * @returns {void}
 * @async
 */

/**
 * @typedef {Object} BenbotOptionChoice
 * @property {string} name The choice name to be displayed
 * @property {any} value The internal value of the choice
 * @property {import('discord.js').LocalizationMap|undefined} name_localizations
 */

/**
 * @typedef {Object} BenbotOption
 * @property {string} name The option name
 * @property {string} description The option description
 * @property {string} type The option type. Take a `SlashCommandBuilder` and look at all the "add(something)Option" methods, if you want to add an StringOption, set this to `"String"`. Same goes for all other option types.
 * @property {Object} data Extra fields that can be set optionally. For example, if this is a StringOption and you want to set the minimum string length, set `data.MinLength` to a positive number.
 * @property {Array<BenbotOptionChoice>|undefined} choices An array of `BenbotOptionChoices`. Only some option types use this and its not required to.
 */

/**
 * @typedef {Object} BenbotCommand
 * @property {string} name The command/subcommand name.
 * @property {string} description The command/subcommand description.
 * @property {Object} data Extra fields that can be set optionally. For example, if you want to make the command use autocomplete, you would add a key named `"autocomplete"` with value set to `true`.
 * @property {boolean} hasSubcommands If this command has subcommands, set this to true. Setting this to true will make the command parser expect an array of `BenbotCommands` set as `"subcommands"`. The command parser ignores this value on any `BenbotCommands` passed in the subcommands array.
 * @property {Array<BenbotCommand>|undefined} subcommands An array containing the subcommands of a command.
 * @property {Array<BenbotOptionChoice>} options The options that a command should have.
 */

class InventoryItem {
    #id = "";
    #subtypeID = "";
    #generalName = "";
    #itemName = "";
    #stackable = false;
    #flags = [];
    #maxStack = 0;
    count = 0;
    data = {};

    constructor(data) {
        this.#id = data.id;
        this.#subtypeID = data.subtypeID;
        this.#generalName = data.generalDisplayName;
        this.#itemName = data.itemName;
        this.#stackable = data.stackable;
        this.#flags = data.flags;
        this.#maxStack = data.maxStack;
        this.count = data.count;
        this.data = data.data;
    }

    get id() {
        return this.#id;
    }

    get subtypeID() {
        return this.#subtypeID;
    }

    get generalName() {
        return this.#generalName;
    }

    get itemName() {
        return this.#itemName;
    }

    get stackable() {
        return this.#stackable;
    }

    get maxStack() {
        return this.#maxStack;
    }

    hasFlag(flag) {
        return this.#flags.indexOf(flag) !== -1;
    }

    toJSONString() {
        let objectToBeStringified = {
            id: this.#id,
            subtypeID: this.#subtypeID,
            generalDisplayName: this.#generalName,
            itemName: this.#itemName,
            stackable: this.#stackable,
            flags: this.#flags,
            maxStack: this.#maxStack,
            count: this.count,
            data: this.data,
        };

        return JSON.stringify(objectToBeStringified);
    }
}

class Inventory {
    /**
     * An array with the items on this inventory.
     * @type {InventoryItem[]}
     */
    #items = [];
    /**
     * The maximum number of item stacks the inventory can hold.
     * @type {number}
     */
    maxSlots = 25;
    /**
     * The discord user linked to this inventory.
     * @type {DiscordUser}
     */
    #user = null;

    /**
     * The discord user linked to this inventory.
     * @returns {DiscordUser}
     */
    get user() {
        return this.#user;
    }

    /**
     * Creates a new empty inventory.
     * @param {DiscordUser} user
     */
    constructor(user) {
        this.#user = user;
    }

    /**
     * Returns true if an item with the specified `itemID` exists in the inventory. false otherwise.
     * Optionally, you can check for the existence of an item with a specific `itemSubtypeID`.
     * @param {string} itemID
     * @param {string|undefined} itemSubtypeID
     */
    hasItem(itemID, itemSubtypeID) {
        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];
            if (item.id === itemID) {
                if (
                    typeof itemSubtypeID !== "undefined" &&
                    item.subtypeID !== itemSubtypeID
                )
                    return false;
                return true;
            }
        }
        return false;
    }

    /**
     * Tries to add an item to the inventory.
     * Returns true if everything went well, a number otherwise.
     *
     * Number codes:
     *
     * -1 - Tried adding an item with the CAN_ONLY_HAVE_ONE flag that already is present in the inventory.
     * @param {InventoryItem} item
     * @returns {true|number}
     */
    addItem(item) {
        if (item instanceof InventoryItem === false)
            throw "item argument is not an InventoryItem.";

        if (
            item.hasFlag(ITEM_FLAGS.CAN_ONLY_HAVE_ONE) &&
            this.hasItem(item.id, item.subtypeID)
        )
            return -1;

        this.#items.push(item);

        if (typeof item["onAdded"] === "function") item.onAdded(this);

        return true;
    }

    /**
     * Removes the `item` from the inventory.
     * The `item` InventoryItem must be in the inventory, if it isnt, the function will return `false`.
     *
     * For less specific inventory item removing, use the `removeItemAtIndex` and the `removeItemWithID` functions.
     * @param {InventoryItem} item
     * @returns {boolean} true if item was removed successfully, false if the item wasn't found in the inventory.
     */
    removeItem(item) {
        if (item instanceof InventoryItem === false)
            throw "item argument is not an InventoryItem.";

        for (let i = 0; i < this.#items.length; i++) {
            const itemInInventory = this.#items[i];
            if (item === itemInInventory) {
                if (typeof item["onRemoved"] === "function")
                    item.onRemoved(this);

                let itemsAfterRemoved = this.#items.splice(i);
                itemsAfterRemoved.shift();
                this.#items = this.#items.concat(itemsAfterRemoved);
            }
        }
    }

    /**
     * Removes an item on the specified index.
     * @param {number} index
     */
    removeItemAtIndex(index) {
        if (index > this.#items.length - 1) return;

        let itemsAfterRemoved = this.#items.splice(index);
        const itemRemoved = itemsAfterRemoved.shift();
        if (typeof itemRemoved["onRemoved"] === "function")
            itemRemoved.onRemoved(this);
        this.#items = this.#items.concat(itemsAfterRemoved);
    }

    /**
     * Removes an item with the specific `itemID` and optionally, `itemSubtypeID`.
     * A start index for the item search can be specified.
     * @param {string} itemID
     * @param {string|undefined} itemSubtypeID
     * @param {number|undefined} searchStart
     */
    removeItemWithID(itemID, itemSubtypeID, searchStart = 0) {
        if (searchStart > this.#items.length - 1) return;

        for (let i = searchStart; i < this.#items.length; i++) {
            const itemInInventory = this.#items[i];
            if (itemInInventory.id == itemID) {
                if (
                    typeof itemSubtypeID !== "undefined" &&
                    itemInInventory.subtypeID !== itemSubtypeID
                )
                    continue;

                if (typeof itemInInventory["onRemoved"] === "function")
                    itemInInventory.onRemoved(this);

                let itemsAfterRemoved = this.#items.splice(i);
                itemsAfterRemoved.shift();
                this.#items = this.#items.concat(itemsAfterRemoved);
            }
        }
    }

    /**
     * Finds the index that is occupied by the `item`.
     * This function searches for the `item` inside the inventory, so if the `item` is not in the inventory, the function will return `null`.
     *
     * For less specific searching, use `findIndexByItemID` instead.
     * @param {InventoryItem} item
     * @returns {number|null}
     */
    findIndexByItem(item) {
        if (item instanceof InventoryItem === false)
            throw "item argument is not an InventoryItem.";

        for (let i = 0; i < this.#items.length; i++) {
            if (item === this.#items[i]) return i;
        }

        return null;
    }

    /**
     * Finds the index that is occupied by an item with the same `itemID` and `itemSubtypeID`.
     * @param {string} itemID
     * @param {string|undefined} itemSubtypeID
     * @returns {number|null}
     */
    findIndexByItemID(itemID, itemSubtypeID) {
        for (let i = 0; i < this.#items.length; i++) {
            const itemInInventory = this.#items[i];
            if (itemID === itemInInventory.id) {
                if (
                    typeof itemSubtypeID !== "undefined" &&
                    itemSubtypeID !== itemInInventory.subtypeID
                )
                    continue;
                return i;
            }
            return null;
        }
    }

    /**
     * Returns the total amount of items with the specified `itemID` and `itemSubtypeID` present in the inventory.
     * @param {string} itemID
     * @param {string|undefined} itemSubtypeID
     */
    getTotalItemCount(itemID, itemSubtypeID) {
        let totalCount = 0;

        for (let i = 0; i < this.#items.length; i++) {
            const itemInInventory = this.#items[i];
            if (itemInInventory.id === itemID) {
                if (
                    typeof itemSubtypeID !== "undefined" &&
                    itemInInventory.subtypeID !== itemSubtypeID
                )
                    continue;

                totalCount += itemInInventory.count;
            }
        }

        return totalCount;
    }

    toJSON() {
        let objectToBeStringified = {
            maxSlots: this.maxSlots,
            items: [],
        };

        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];
            objectToBeStringified.items.push(item.toJSONString());
        }

        return objectToBeStringified;
    }

    /**
     * Creates an inventory from a JSON object.
     * @param {Object} inventoryObject
     * @param {DiscordUser} user
     */
    static fromJSON(inventoryObject, user) {
        let inventory = new Inventory(user);

        for (let i = 0; i < inventoryObject.items.length; i++) {
            const item = new InventoryItem(inventoryObject[i]);

            inventory.#items.push(item);
        }

        return inventory;
    }
}

class User {
    /**
     * The number of bencoins a user has.
     * @type {number}
     */
    bencoins = 0;
    /**
     * The number which represents the level of a user.
     * @type {number}
     */
    level = 0;
    /**
     * The number which represents the amount of experience a user has.
     * @type {number}
     */
    experience = 0;
    /**
     * A user's about me string.
     * @type {string}
     */
    about = "";
    /**
     * The user's inventory
     * @type {Inventory}
     */
    inventory = null;
    #id = "";
    /**
     * The user's ID.
     * @type {string}
     */
    get id() {
        return this.#id;
    }

    /**
     * @type {import('sequelize').Model}
     */
    #model = null;

    /**
     * @type {BenbotInstance}
     */
    #instance = null;

    get instance() {
        return this.#instance;
    }

    /**
     * Creates a new User class.
     * @param {import('sequelize').Model} model The model that will be used to fill the class' fields.
     * @param {DiscordUser} user The user tied to this class.
     */
    constructor(model, user, instance) {
        this.bencoins = model.bencoins;
        this.about = model.about;
        this.level = model.level;
        this.experience = model.experience;
        this.#id = model.id;
        this.#model = model;
        this.#instance = instance;

        this.inventory = Inventory.fromJSON(JSON.parse(model.inventory), user);
    }

    /**
     * Saves all the data for this user into the database of the `BenbotInstance` which created this `User` object.
     */
    async save() {
        this.#model.bencoins = this.bencoins;
        this.#model.about = this.about;
        this.#model.level = this.level;
        this.#model.experience = this.experience;
        this.#model.id = this.#id;
        this.#model.inventory = JSON.stringify(this.inventory.toJSON());

        await this.#model.save();
    }
}

class BenbotInstance {
    #private = {
        /**
         * @type {Sequelize}
         */
        database: null,
        initialized: false,
        attributes: null,
        /**
         * @type {import('sequelize').Model}
         */
        userModel: null,
        /**
         * @type {Client}
         */
        client: null,
        /**
         * @type {Collection<SlashCommandBuilder, BenbotInteractionCallback>}
         */
        slashCommands: new Collection(),
        inventory_item_flags: {},
        /**
         * @type {REST}
         */
        rest: null,
        botUserID: "",
        /**
         * @type {Object<keyof import('discord.js').ClientEvents, Object<Function, Function>>}
         */
        clientEventCollection: {},
    };

    /**
     * Listens to a event within this instance's client.
     * Unlike regular `EventListeners`, this function does check already added listeners, so trying to add the same listener to the same `event` will throw an error.
     * @param {keyof import('discord.js').ClientEvents} event
     * @param {(instance : BenbotInstance, ...any) => void} callback
     */
    onClientEvent(event, callback) {
        let events = this.#private.clientEventCollection[event];
        if (typeof events === "undefined") {
            events = {};
            this.#private.clientEventCollection[event] = events;
        }
        assert(
            callback in events === false,
            "This event already has this callback listening to it.",
        );
        const bindFunction = (...args) => {
            callback(this, ...args);
        };
        events[callback] = bindFunction;
        this.client.on(event, bindFunction);
    }

    /**
     * Disconnects a callback from listening a client event.
     * @param {keyof import('discord.js').ClientEvents} event
     * @param {(instance : BenbotInstance, ...any) => void} callback
     */
    offClientEvent(event, callback) {
        let events = this.#private.clientEventCollection[events];
        if (typeof events === "undefined") return;
        if (callback in events === false) return;
        this.client.off(event, events[callback]);
        delete events[callback];
    }

    #onInstanceCreate() {
        for (const item_flag in ITEM_FLAGS) {
            this.#private.inventory_item_flags[item_flag] =
                ITEM_FLAGS[item_flag];
        }
    }

    /**
     * Adds an item flag which can be applied to all items of inventories owned by this instance.
     * @param {string} item_flag The flag to be added
     */
    add_inventory_item_flag(item_flag) {
        if (
            typeof this.#private.inventory_item_flags[item_flag] !== "undefined"
        )
            return;
        this.#private.inventory_item_flags[item_flag] = item_flag;
    }

    /**
     * Removes an item flag. Can only remove flags that were added with `add_inventory_item_flags` (cannot remove builtin flags such as `CAN_ONLY_HAVE_ONE`).
     * @param {string} item_flag The flag to be removed.
     */
    remove_inventory_item_flag(item_flag) {
        if (
            typeof this.#private.inventory_item_flags[item_flag] === "undefined"
        )
            return;
        if (typeof ITEM_FLAGS[item_flag] !== "undefined") return;

        delete this.#private.inventory_item_flags[item_flag];
    }

    get inventory_item_flags() {
        return new Proxy(this.#private.inventory_item_flags, {
            set: () => {
                throw "inventory_item_flags is read only. To add or remove flags use the add_inventory_item_flag and remove_inventory_item_flag methods respectively";
            },
        });
    }

    /**
     * @constructor Creates a new Benbot instance.
     * @param {string} database The name of the database.
     * @param {string} username The username that will be used to authenticate the database.
     * @param {string} password The password that will be used to authenticate the database.
     * @param {import('sequelize').Options} options An object with options.
     * @param {import('discord.js').ClientOptions} clientOptions The options that will be used to create a discord client.
     */
    constructor(database, username, password, options, clientOptions) {
        this.#private.database = new Sequelize(
            database,
            username,
            password,
            options,
        );
        this.#private.client = new Client(clientOptions);
        this.#onInstanceCreate();
    }

    /**
     * The discord client that this `BenbotInstance` uses
     */
    get client() {
        return this.#private.client;
    }

    /**
     * Initializes the instance, defines the User model and creates the discord client for this instance.
     * @param {Object|undefined} extraAttributes Any extra attributes that should be passed to the User model.
     * @example ```js
     *     let instance = new BenbotInstance(...); // pretend like something was passed here.
     *     await instance.init("bot token here");
     *     // I want an extra number attribute named "deaths" that cannot be null with default value 0:
     *     let extraAttributes = {
     *             "deaths": {
     *                 // data.type is converted to sequelize.DataTypes, then data is passed to database.define().
     *                 // this allows you to add more arguments like "primaryKey" (assuming you change ./config/user_model.json to remove the "primaryKey" value from the "id" attribute)
     *                 "data": {
     *                     "type": "NUMBER",
     *                     "allowNull": false
     *                 },
     *                 "defaultValue": 0
     *             },
     *             // or instead of editing ./config/user_model_attributes.json you can patch the attribute you want by including it
     *             // in your extra attributes object.
     *             "id": {
     *                 // you know what i dont want the "id" attribute to be the primary key anymore.
     *                 "data": {
     *                     "primaryKey": false,
     *                     "type": "STRING"
     *                 }
     *             }
     *     }
     *     await instance.init("bot token here", extraAttributes);
     * ```
     * @param {string} botToken The bot token of the discord bot.
     * @param {string} botUserID The user ID of the bot.
     */
    async init(botToken, botUserID, extraAttributes) {
        if (typeof botToken !== "string") throw "botToken is not a string.";
        if (typeof botUserID !== "string") throw "botUserID is not a string.";

        if (this.#private.initialized === true) return;

        if (extraAttributes instanceof Object === false) extraAttributes = {};
        extraAttributes = copyObject(extraAttributes);

        await this.#private.database.authenticate();

        this.#private.attributes = copyObject(userModelJSON);

        for (const [attributeName, attributeData] of Object.entries(
            extraAttributes,
        )) {
            this.#private.attributes[attributeName] = attributeData;
        }

        for (let [attributeName, attributeData] of Object.entries(
            userModelJSON,
        )) {
            const dataType = DataTypes[attributeData.data.type];
            if (typeof dataType === "undefined")
                throw `Invalid data type for attribute ${attributeName}. (${attributeData.data.type})`;

            attributeData.data.type = dataType;
        }

        this.#private.userModel = this.#private.database.define(
            "User",
            this.#private.attributes,
        );

        await this.client.login(botToken);
        this.client.on("interactionCreate", this.#onInteractionCreate);
        this.#private.rest = new REST().setToken(botToken);
        this.#private.botUserID = botUserID;

        this.#private.initialized = true;
        return;
    }

    /**
     * Returns a user class from a discord user.
     * @param {DiscordUser} user
     * @returns {User}
     */
    async getUser(user) {
        if (user instanceof DiscordUser === false)
            throw "user must be a discord User";
        if (this.#private.initialized === false)
            throw "This BenbotInstance was not initialized yet. Run init() before calling any other methods.";

        const [userModel, created] = await this.#private.userModel.findOrCreate(
            {
                where: { id: user.id },
            },
        );

        if (created) {
            for (const [attributeName, attributeData] of Object.entries(
                this.#private.attributes,
            )) {
                if (typeof attributeData["defaultValue"] === "undefined")
                    continue;
                userModel[attributeName] = attributeData.defaultValue;
            }

            userModel.inventory = new Inventory(user).toJSONString();
            await userModel.save();
        }

        return new User(userModel, user, this);
    }

    #makeCommand(commandData, isSubcommand) {
        let command = isSubcommand
            ? new SlashCommandSubcommandBuilder()
            : new SlashCommandBuilder();
        command.setName(commandData.name);
        command.setDescription(commandData.description);
        for (const commandDataKey of commandData.data) {
            const commandDataValue = commandData.data[commandDataKey];
            if (typeof command[`set${commandDataKey}`] === "function") {
                command[`set${commandDataKey}`](commandDataValue);
                continue;
            }
            command[commandDataKey] = commandDataValue;
        }
        if (!isSubcommand && commandData.hasSubcommands === true) {
            for (
                let iSubcommand = 0;
                iSubcommand < commandData.subcommands.length;
                isSubcommand++
            ) {
                const subcommand = this.#makeCommand(
                    commandData.subcommands[iSubcommand],
                    true,
                );
                command.addSubcommand(subcommand);
            }
            return command;
        }
        for (let iOption = 0; iOption < commandData.options.length; iOption++) {
            this.#parseCommandOptions(command, commandData.options[iOption]);
        }
        return command;
    }

    /**
     * @param {SlashCommandBuilder|SlashCommandSubcommandBuilder} command
     * @param {BenbotOption} optionData
     */
    #parseCommandOptions(command, optionData) {
        assert(
            `add${optionData.type}Option` in command,
            `No such option type as ${optionData.type}.`,
        );
        command[`add${optionData.type}Option`]((builder) => {
            builder.setName(optionData.name);
            builder.setDescription(optionData.description);
            for (let optionDataKey of optionData.data) {
                const optionDataValue = optionData.data[optionDataKey];
                if (typeof builder[`set${optionDataKey}`] === "function") {
                    builder[`set${optionDataKey}`](optionDataValue);
                    continue;
                }
                builder[optionDataKey] = optionDataValue;
            }
            if (builder["setChoices"] !== undefined)
                builder.setChoices(optionData.choices);
            return builder;
        });
    }

    /**
     * Creates a slash command that when ran calls `callback`. You may pass an already existing `SlashCommandBuilder` as the `commandData` argument.
     * @param {BenbotInteractionCallback} callback
     * @param {BenbotCommand|SlashCommandBuilder} commandData
     */
    addCommand(commandData, callback) {
        let command = commandData;
        if (commandData instanceof SlashCommandBuilder === false)
            command = this.#makeCommand(commandData, false);
        this.#private.slashCommands.set(command, callback);
    }

    /**
     * Tells discord that we have some commands we would like to register. Should only be called once then only again after a you add a new slash command.
     * @param {import('discord.js').RouteLike|undefined} route A custom route that should be used to register the commands. If not specified it uses Routes.applicationCommands() as the default.
     */
    async registerCommands(route) {
        let commands = [];
        this.#private.slashCommands.forEach((_, slashCommand) => {
            commands.push(slashCommand.toJSON());
        });
        try {
            if (!route)
                route = Routes.applicationCommands(this.#private.botUserID);
            await this.#private.rest.put(route, { body: commands });
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * @param {import('discord.js').Interaction} interaction
     */
    async #onInteractionCreate(interaction) {
        if (interaction.isChatInputCommand()) {
            /**
             * @type {BenbotInteractionCallback}
             */
            const command = this.#private.slashCommands.find(
                (_, slashCommand) =>
                    slashCommand.name === interaction.command.name,
            );
            if (typeof command === "undefined")
                return console.warn(
                    `Slash command with name ${interaction.command.name} has no matching callback function!`,
                );

            try {
                await command(this, interaction);
            } catch (error) {
                console.error(
                    `An error occured when running the callback function from command ${interaction.command.name}!`,
                );
                console.error(error);
            }
            return;
        }
    }

    /**
     * Creates a new `BenbotInstance` from an already existing `Sequelize` database
     * @param {Sequelize} sequelize
     * @param {import('discord.js').ClientOptions} clientOptions
     * @returns {BenbotInstance}
     */
    static fromSequelize(sequelize, clientOptions) {
        /**
         * @type {BenbotInstance}
         */
        let instance = Object.create(BenbotInstance.prototype);

        instance.#private.client = new Client(clientOptions);
        instance.#private.database = sequelize;

        instance.#onInstanceCreate();

        return instance;
    }
}

module.exports = {
    BenbotInstance,
    User,
    Inventory,
    InventoryItem,
};
