use sea_orm_migration::prelude::*;

use crate::m20240101_000002_create_rooms::Rooms;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Videos::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Videos::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Videos::RoomId).uuid().not_null())
                    .col(ColumnDef::new(Videos::SourceUrl).text().not_null())
                    .col(ColumnDef::new(Videos::Title).string_len(256).null())
                    .col(ColumnDef::new(Videos::FilePath).text().null())
                    .col(ColumnDef::new(Videos::FileSize).big_integer().null())
                    .col(ColumnDef::new(Videos::MimeType).string_len(64).null())
                    .col(ColumnDef::new(Videos::Duration).float().null())
                    .col(
                        ColumnDef::new(Videos::Status)
                            .string_len(32)
                            .not_null()
                            .default("pending"),
                    )
                    .col(ColumnDef::new(Videos::DownloadProgress).float().default(0.0))
                    .col(
                        ColumnDef::new(Videos::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Videos::Table, Videos::RoomId)
                            .to(Rooms::Table, Rooms::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Videos::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
pub enum Videos {
    Table,
    Id,
    RoomId,
    SourceUrl,
    Title,
    FilePath,
    FileSize,
    MimeType,
    Duration,
    Status,
    DownloadProgress,
    CreatedAt,
}
