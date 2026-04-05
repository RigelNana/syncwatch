use sea_orm_migration::prelude::*;

use crate::m20240101_000001_create_users::Users;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Rooms::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Rooms::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Rooms::Name).string_len(128).not_null())
                    .col(ColumnDef::new(Rooms::OwnerId).uuid().not_null())
                    .col(ColumnDef::new(Rooms::VideoUrl).text().null())
                    .col(
                        ColumnDef::new(Rooms::Status)
                            .string_len(32)
                            .not_null()
                            .default("waiting"),
                    )
                    .col(
                        ColumnDef::new(Rooms::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        ColumnDef::new(Rooms::LastActiveAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Rooms::Table, Rooms::OwnerId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Rooms::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
pub enum Rooms {
    Table,
    Id,
    Name,
    OwnerId,
    VideoUrl,
    Status,
    CreatedAt,
    LastActiveAt,
}
