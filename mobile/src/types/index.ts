// Tipos principales de la aplicación

export interface User {
  id: string;
  email: string;
  createdAt: string;
  profile?: Profile;
}

export interface Profile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  city: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  interests?: Interest[];
}

export interface Interest {
  id: string;
  name: string;
  icon?: string;
}

export interface UserInterest {
  id: string;
  userId: string;
  interestId: string;
  interest: Interest;
}

export interface Swipe {
  id: string;
  swipedBy: string;
  swipedOn: string;
  action: 'like' | 'dislike';
  createdAt: string;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
  user1?: Profile;
  user2?: Profile;
  chat?: Chat;
}

export interface Chat {
  id: string;
  matchId?: string;
  user1Id: string;
  user2Id: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  user1?: Profile;
  user2?: Profile;
  messages?: Message[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content?: string;
  mediaId?: string;
  read: boolean;
  createdAt: string;
  sender?: Profile;
  media?: Media;
}

export interface Media {
  id: string;
  profileId?: string;
  messageId?: string;
  url: string;
  type: 'profile' | 'message';
  mimeType: string;
  size?: number;
  createdAt: string;
}

// Tipos de navegación
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Home: undefined;
  Chats: undefined;
  Profile: undefined;
  ChatDetail: { chatId: string; userId: string };
  UserProfile: { userId: string };
  EditProfile: undefined;
  RegisterStep1: undefined;
  RegisterStep2: undefined;
  RegisterStep3: undefined;
  RegisterStep4: undefined;
  RegisterStep5: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  RegisterStep1: undefined;
  RegisterStep2: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    city?: string;
    avatarUri?: string;
  };
  RegisterStep3: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    city?: string;
    avatarUri?: string;
  };
  RegisterStep4: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    city?: string;
    avatarUri?: string;
    interests?: string[];
  };
};

