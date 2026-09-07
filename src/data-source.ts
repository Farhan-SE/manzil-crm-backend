import 'dotenv/config';
import {DataSource} from 'typeorm';

const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: false,
    synchronize: false,
    logging: true,
    entities: ['dist/**/*.entity.js'],
    migrations: ['dist/database/migrations/*.js'],
});

export default AppDataSource;

