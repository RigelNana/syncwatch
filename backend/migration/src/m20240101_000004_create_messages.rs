use sea_orm_migration::prelude::*;

use crate::m20240101_000001_create_users::Users;
use crate::m20240101_000002_create_rooms::Rooms;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Messages::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Messages::RoomId).uuid().not_null())
                    .col(ColumnDef::new(Messages::UserId).uuid().not_null())
                    .col(ColumnDef::new(Messages::Content).text().not_null())
                    .col(
                        ColumnDef::new(Messages::MsgType)
                            .string_len(32)
                            .not_null()
                            .default("chat"),
                    )
                    .col(
                        ColumnDef::new(Messages::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Messages::Table, Messages::RoomId)
                            .to(Rooms::Table, Rooms::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Messages::Table, Messages::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Messages::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
pub enum Messages {
    Table,
    Id,
    RoomId,
    UserId,
    Content,
    MsgType,
    CreatedAt,
}
