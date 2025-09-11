export interface Podcast {
  uid: string;
  title: string;
  host: string;
  description: string;
  audioUrl: string;
  localAudioUrl: string;
  imageUrl: string;
  publishedDate: number;
  tags: string[];
}