pub use sea_orm_migration::prelude::*;

mod m20240101_000001_create_users;
mod m20240101_000002_create_rooms;
mod m20240101_000003_create_videos;
mod m20240101_000004_create_messages;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20240101_000001_create_users::Migration),
            Box::new(m20240101_000002_create_rooms::Migration),
            Box::new(m20240101_000003_create_videos::Migration),
            Box::new(m20240101_000004_create_messages::Migration),
        ]
    }
}
