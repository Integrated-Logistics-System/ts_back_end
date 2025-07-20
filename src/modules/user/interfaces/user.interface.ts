export interface UserProfile {
    id: string;
    email: string;
    name: string;
    allergies: string[];
    cookingLevel: string;
    preferences: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserData {
    email: string;
    password: string;
    name?: string;
    cookingLevel?: string;
    preferences?: string[];
}

export interface UserForAuth {
    id: string;
    email: string;
    name: string;
}