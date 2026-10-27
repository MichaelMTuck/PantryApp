BEGIN;

CREATE SCHEMA pantry_app AUTHORIZATION pantry_user;

SET LOCAL search_path TO pantry_app;

-- APP ACCOUNTS
-- Passwords must be hashed by the backend before insertion.
CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (email = lower(trim(email))),
    CHECK (length(trim(email)) > 0),
    CHECK (length(trim(display_name)) > 0),
    CHECK (length(password_hash) > 0)
);

-- Store a hash of the login token, not its plaintext value.
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

-- SHARED PANTRIES
CREATE TABLE pantries (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (length(trim(name)) > 0)
);

CREATE TABLE pantry_members (
    pantry_id INTEGER NOT NULL
        REFERENCES pantries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (pantry_id, user_id),
    CHECK (role IN ('owner', 'member'))
);

-- At most one owner per pantry.
CREATE UNIQUE INDEX pantry_one_owner_idx
    ON pantry_members(pantry_id)
    WHERE role = 'owner';

CREATE INDEX pantry_members_user_idx
    ON pantry_members(user_id);

-- Single-use invitation tokens.
CREATE TABLE pantry_invites (
    token_hash TEXT PRIMARY KEY,
    pantry_id INTEGER NOT NULL
        REFERENCES pantries(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL
        REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (expires_at > created_at)
);

CREATE INDEX pantry_invites_pantry_idx
    ON pantry_invites(pantry_id);

-- INGREDIENT CATALOG
-- BARCODES ARE OPTIONAL, BUT IF PROVIDED MUST BE UNIQUE.
CREATE TABLE ingredients (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    barcode VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (length(trim(name)) > 0),
    CHECK (barcode IS NULL OR length(trim(barcode)) > 0)
);

CREATE INDEX ingredients_name_idx ON ingredients(lower(name));

-- PANTRY STOCK
CREATE TABLE pantry_items (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pantry_id INTEGER NOT NULL
        REFERENCES pantries(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL
        REFERENCES ingredients(id),
    quantity NUMERIC(14,4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    expiration_date DATE,
    purchased_on DATE,
    total_cost NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (quantity >= 0),
    CHECK (length(trim(unit)) > 0),
    CHECK (total_cost IS NULL OR total_cost >= 0)
);

CREATE INDEX pantry_items_pantry_idx ON pantry_items(pantry_id);
CREATE INDEX pantry_items_ingredient_idx ON pantry_items(ingredient_id);
CREATE INDEX pantry_items_expiry_idx
    ON pantry_items(pantry_id, expiration_date);

-- RECIPES SHARED WITHIN A PANTRY
CREATE TABLE recipes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pantry_id INTEGER NOT NULL
        REFERENCES pantries(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL
        REFERENCES users(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    prep_minutes INTEGER NOT NULL DEFAULT 0,
    cook_minutes INTEGER NOT NULL DEFAULT 0,
    servings NUMERIC(8,2) NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (id, pantry_id),
    CHECK (length(trim(name)) > 0),
    CHECK (prep_minutes >= 0),
    CHECK (cook_minutes >= 0),
    CHECK (servings > 0)
);

CREATE INDEX recipes_pantry_idx ON recipes(pantry_id);

CREATE TABLE recipe_ingredients (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipe_id INTEGER NOT NULL
        REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL
        REFERENCES ingredients(id),
    quantity NUMERIC(14,4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    note TEXT,
    position INTEGER NOT NULL,

    UNIQUE (recipe_id, position),
    CHECK (quantity > 0),
    CHECK (position > 0),
    CHECK (length(trim(unit)) > 0)
);

CREATE INDEX recipe_ingredients_ingredient_idx
    ON recipe_ingredients(ingredient_id);

CREATE TABLE recipe_steps (
    recipe_id INTEGER NOT NULL
        REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,

    PRIMARY KEY (recipe_id, step_number),
    CHECK (step_number > 0),
    CHECK (length(trim(instruction)) > 0)
);

-- Favorites are personal, while the recipe belongs to a pantry.
CREATE TABLE recipe_favorites (
    pantry_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,

    PRIMARY KEY (recipe_id, user_id),

    FOREIGN KEY (recipe_id, pantry_id)
        REFERENCES recipes(id, pantry_id)
        ON DELETE CASCADE,

    FOREIGN KEY (pantry_id, user_id)
        REFERENCES pantry_members(pantry_id, user_id)
        ON DELETE CASCADE
);

CREATE INDEX recipe_favorites_member_idx
    ON recipe_favorites(pantry_id, user_id);

-- SHARED SHOPPING LISTS
CREATE TABLE shopping_lists (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pantry_id INTEGER NOT NULL
        REFERENCES pantries(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL DEFAULT 'Shopping List',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (length(trim(name)) > 0)
);

CREATE INDEX shopping_lists_pantry_idx ON shopping_lists(pantry_id);

CREATE TABLE shopping_list_items (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shopping_list_id INTEGER NOT NULL
        REFERENCES shopping_lists(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL
        REFERENCES ingredients(id),
    quantity NUMERIC(14,4) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,

    CHECK (quantity > 0),
    CHECK (length(trim(unit)) > 0)
);

CREATE INDEX shopping_list_items_list_idx
    ON shopping_list_items(shopping_list_id);

CREATE INDEX shopping_list_items_ingredient_idx
    ON shopping_list_items(ingredient_id);

COMMIT;
