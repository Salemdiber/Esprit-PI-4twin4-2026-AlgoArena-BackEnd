import { Entity, Column, ObjectIdColumn } from 'typeorm';

export enum Role {
  Player = 'Player',
  Admin = 'Admin',
}
@Entity()
export class User {
  @ObjectIdColumn()
  userId: string;

  @Column()
  username: string;

  @Column()
  passwordHash: string;

  @Column()
  email: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.Player,
  })
  role: Role;

  @Column({ nullable: true })
  avatar: string | null;

  @Column({ nullable: true })
  bio: string | null;

  @Column({ default: true })
  status: boolean;

  @Column({ nullable: true })
  resetPasswordToken: string | null;

  @Column({ nullable: true })
  resetPasswordExpires: Date | null;

  @Column({ nullable: true })
  resetPasswordCode: string | null;

  @Column({ default: false })
  resetPasswordCodeVerified: boolean;
}
