/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
    'fluent-ffmpeg',
    'ffmpeg-static',
    'sharp',
    'sqlite3',
    '@distube/ytdl-core',
    'node-gtts',
  ],
};

module.exports = nextConfig;
